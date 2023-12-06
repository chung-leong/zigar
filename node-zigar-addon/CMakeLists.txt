cmake_minimum_required(VERSION 3.15)
cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

project (node-zigar-addon)

add_definitions(-DNAPI_VERSION=6)

include_directories(${CMAKE_JS_INC})

if(MSVC)
    # add win32 shim
    file(GLOB SOURCE_FILES ${PROJECT_SOURCE_DIR}/src/*.c)
else()
    file(GLOB SOURCE_FILES ${PROJECT_SOURCE_DIR}/src/addon*.c)
endif()
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
if(MSVC)
    # dbghelp.lib is needed for redirection to console
    target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB} dbghelp.lib)
else()
    target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})
endif()

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
