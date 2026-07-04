import { Sun, Moon, House, Github } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { DeviceCard } from '@/components/DeviceCard';
import { TYPES } from './data';

// Static showcase of every accessory type, rendered with the real card
// components. Built as its own page for GitHub Pages.
export function Showcase() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-2 gap-3">
          <div className="flex items-center gap-2">
            <House className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">mqtt-homekit</h1>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="https://github.com/mqtt-home/mqtt-homekit"
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="GitHub repository"
            >
              <Github className="h-5 w-5 text-foreground" />
            </a>
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-accent transition-colors" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-5 w-5 text-foreground" /> : <Moon className="h-5 w-5 text-foreground" />}
            </button>
          </div>
        </header>

        <p className="text-muted-foreground mb-8 max-w-3xl">
          A lightweight MQTT → HomeKit bridge in Go. Every accessory type below is
          declared in a small YAML config and appears both in Apple Home and on the
          built-in web dashboard — these cards are the real dashboard components,
          try the controls.
        </p>

        {/* Type index */}
        <nav className="flex flex-wrap gap-2 mb-10">
          {TYPES.map(t => (
            <a
              key={t.kind}
              href={`#${t.kind}`}
              className="px-3 py-1 rounded-full bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.title}
            </a>
          ))}
        </nav>

        <div className="space-y-12">
          {TYPES.map(t => (
            <section key={t.kind} id={t.kind} className="scroll-mt-4">
              <h2 className="text-lg font-bold text-foreground mb-1">{t.title}</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-3xl">{t.blurb}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  {t.devices.map(d => (
                    <DeviceCard key={d.aid} device={d} />
                  ))}
                  <table className="w-full text-sm">
                    <tbody>
                      {t.gets.map(([name, desc]) => (
                        <tr key={name} className="border-t border-border">
                          <td className="py-1.5 pr-3 font-mono text-xs text-foreground whitespace-nowrap">{name}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{desc}</td>
                          <td className="py-1.5 text-xs text-right">
                            {t.sets.includes(name.split(' ')[0]) ? (
                              <span className="text-green-500 font-medium">read / write</span>
                            ) : (
                              <span className="text-muted-foreground">read</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <pre className="bg-card border border-border rounded-xl p-4 text-xs leading-relaxed overflow-x-auto text-foreground">
                  <code>{t.yaml}</code>
                </pre>
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-16 pb-8 text-center text-xs text-muted-foreground">
          <a href="https://github.com/mqtt-home/mqtt-homekit" className="hover:text-foreground transition-colors">
            mqtt-home/mqtt-homekit
          </a>
          {' · '}Apache-2.0
        </footer>
      </div>
    </div>
  );
}
