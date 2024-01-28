const heading = document.getElementById('heading')

window.electronAPI.onShowHash((value) => {
  heading.textContent = value;
});
