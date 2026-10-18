// Follow the system appearance live (index.html sets it before first paint).
export function followSystemTheme() {
  const dark = matchMedia('(prefers-color-scheme: dark)')
  dark.addEventListener('change', (e) => {
    // the Wall Display panel draws a dark gradient behind us: stay dark there
    if (document.documentElement.dataset.embed === 'wall-display') return
    document.documentElement.classList.toggle('dark', e.matches)
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'
  })
}
