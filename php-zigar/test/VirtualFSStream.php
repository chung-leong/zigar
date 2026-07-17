<?php

class VirtualFSStream {
    var $node;
    var $position;

    static $directories = [];

    static function add_root_node($name, $dir) {
        self::$directories[$name] = $dir;
    }

    static function remove_root_node($name) {
        unset(self::$directories[$name]);
    }

    static function get_node($path) {
        $url = parse_url($path);
        $root_name = $url["host"];
        if (!isset(self::$directories[$root_name])) return false;
        $node = self::$directories[$root_name];
        if (isset($url["path"])) {
            $path = substr($url["path"], 1);
            if ($path) {
                foreach (explode('/', $path) as $part) {
                    if (!isset($node->children[$part])) return false;
                    $node = $node->children[$part];
                }
            }
        }
        return $node;
    }

    function dir_opendir(string $path, int $options)
    {
        $dir = self::get_node($path);
        if (!isset($dir->children)) return false;
        $this->node = $dir;
        $this->path = $path;
        $this->position = 0;
        return true;
    }

    function dir_closedir()
    {
    } 

    function dir_readdir()
    {
        $keys = array_keys($this->node->children);
        if (!isset($keys[$this->position])) return false;
        $name = $keys[$this->position++];
        return $name;
    }

    function dir_rewinddir()
    {
        $this->position = 0;
        return true;
    }

    function mkdir($path, $mode, $options) 
    {
        $parent = self::get_node(dirname($path));
        if (!isset($parent->children)) return false;
        $name = basename($path);
        if (isset($parent->children[$name])) return false;
        $dir = $parent->children[$name] = new VirtualDir();
        $dir->mode = 0o0040000 | $mode;
        return true;
    }

    function rmdir($path, $options) 
    {
        $parent = self::get_node(dirname($path));
        if (!isset($parent->children)) return false;
        $name = basename($path);
        if (!isset($parent->children[$name])) return false;
        $dir = $parent->children[$name];
        if (!isset($dir->children)) return false;
        unset($parent->children[$name]);
        return true;
    }

    function unlink($path) 
    {
        $parent = self::get_node(dirname($path));
        if (!isset($parent->children)) return false;
        $name = basename($path);
        if (!isset($parent->children[$name])) return false;
        $file = $parent->children[$name];
        if (!isset($file->content)) return false;
        unset($parent->children[$name]);
        return true;
    }

    function rename($path_from, $path_to)
    {
        $dir_from = self::get_node(dirname($path_from));
        if (!isset($dir_from->children)) return false;
        $name_from = basename($path_from);
        if (!isset($dir_from->children[$name_from])) return false;
        $target = $dir_from->children[$name_from];
        $dir_to = self::get_node(dirname($path_to));
        if (!isset($dir_to->children)) return false;
        $name_to = basename($path_to);
        $dir_to->children[$name_to] = $target;
        unset($dir_from->children[$name_from]);
        return true;
    }

    function stream_open($path, $mode, $options, &$opened_path)
    {
        $file = self::get_node($path);
        if (!$file && (strstr($mode, 'w') or strstr($mode, 'x') or strstr($mode, 'c'))) {
            $parent = self::get_node(dirname($path));
            if (isset($parent->children)) {
                $name = basename($path);
                $file = $parent->children[$name] = new VirtualFile();
            }
        }
        if (!isset($file->content)) return false;
        $this->path = $path;
        $this->node = $file;
        $this->position = 0;
        return true;
    }

    function stream_read($count)
    {
        if ($this->node->bad) return false;
        $content = $this->node->content;
        $ret = substr($content, $this->position, $count);
        $this->position += strlen($ret);
        return $ret;
    }

    function stream_write($data)
    {
        if ($this->node->bad) return false;
        $content = &$this->node->content;
        $left = substr($content, 0, $this->position);
        $right = substr($content, $this->position + strlen($data));
        $content = $left . $data . $right;
        $this->position += strlen($data);
        $this->size = strlen($content);
        return strlen($data);
    }

    function stream_tell()
    {
        return $this->position;
    }

    function stream_truncate($new_size) {
        $content = &$this->node->content;
        $len = strlen($content);
        if ($len > $new_size) {
            $content = substr($content, 0, $new_size);
        } else if ($len < $new_size) {
            $content .= str_repeat("\x00", $new_size - $len);
        }
        $this->node->size = $new_size;
        return true;
    }

    function stream_eof()
    {
        $content = $this->node->content;
        return $this->position >= strlen($content);
    }

    function stream_seek($offset, $whence)
    {
        $content = $this->node->content;
        switch ($whence) {
            case SEEK_SET:
                if ($offset <= strlen($content) && $offset >= 0) {
                     $this->position = $offset;
                     return true;
                } else {
                     echo "returning false\n";
                     return false;
                }
                break;

            case SEEK_CUR:
                if ($offset >= 0) {
                     $this->position += $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            case SEEK_END:
                if (strlen($content) + $offset >= 0) {
                     $this->position = strlen($content) + $offset;
                     return true;
                } else {
                     return false;
                }
                break;

            default:
                return false;
        }
    }

    function stream_stat()
    {
        return (array) $this->node;
    }

    function stream_lock($operation)
    {
        switch ($operation & ~LOCK_NB) {
            case LOCK_UN:
                if (!$this->node->lock) return false;
                if ($this->node->lock === INF) {
                    $this->node->lock = 0;
                } else {
                    $this->node->lock--;
                }
                break;
            case LOCK_SH:
                if ($this->node->lock === INF) {
                    // downgrade
                    $this->node->lock = 1;
                } else {
                    $this->node->lock++;
                }
                break;
            case LOCK_EX:
                $this->node->lock = INF;
                break;
        }
        return true;
    }

    function stream_set_option($option, $arg1, $arg2)
    {
        switch ($option) {
            case STREAM_OPTION_BLOCKING:
                $this->node->blocking = !!$arg1;
                break;
        }
        return true;
    }

    function stream_metadata($path, $option, $var) 
    {
        if($option == STREAM_META_TOUCH) {
            $node = self::get_node($path);
            if ($node) {
                $node->mtime = $var[0];
                $node->atime = $var[1];
                return true;
            }
        }
        return false;
    }

    function url_stat($path, $flags)
    {
        $node = self::get_node($path);
        return ($node) ? (array) $node : false;
    }
}

class VirtualFSObject {
    var $size = 0;
    var $atime = 0;
    var $ctime = 0;
    var $mtime = 0;
    var $mode = 0;
    var $path;
}

class VirtualDir extends VirtualFSObject {
    var $children;

    function __construct($children = []) {
        $this->children = $children;
        $this->mode = 0o0040000 | 0o777;
    }
}

class VirtualFile extends VirtualFSObject {
    var $content;
    var $lock;
    var $blocking;
    var $bad;

    function __construct($content = '') {
        $this->content = $content;
        $this->size = strlen($content);
        $this->mode = 0o0100000 | 0o666;
        $this->lock = 0;
        $this->blocking = true;
    }
}

stream_wrapper_register("vfs", "VirtualFSStream")
    or die("Failed to register protocol");
