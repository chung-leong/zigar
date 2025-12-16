function TopNav({}) {
  return (
    <div className="TopNav">            
      <SearchBox />
      <h2>Client-side database demo</h2>
    </div>
  );
}

function SearchBox() {
  return (
    <div className="SearchBox">
      <input type="text" placeholder="Search"/>
    </div>
  );
}

export default TopNav;