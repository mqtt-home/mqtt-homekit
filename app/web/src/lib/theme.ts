// Follow the system appearance live (index.html sets it before first paint).
export function followSystemTheme() {
  const dark = matchMedia('(prefers-color-scheme: dark)')
  dark.addEventListener('change', (e) => {
    document.documentElement.classList.toggle('dark', e.matches)
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light'
  })
}
