import { OSD_ONLY_SETTINGS } from '../../shared/commands'

export function OsdOnlyPanel(): JSX.Element {
  const groups = Array.from(
    OSD_ONLY_SETTINGS.reduce((m, s) => {
      const arr = m.get(s.group) ?? []
      arr.push(s)
      m.set(s.group, arr)
      return m
    }, new Map<string, typeof OSD_ONLY_SETTINGS>())
  )

  return (
    <div className="panel">
      <h2>Settings that require the on-screen menu (TV)</h2>
      <p className="muted">
        These exist on the receiver but the RS-232 protocol does <strong>not</strong> expose them,
        so this app cannot change them. They are listed here so you know exactly what still needs the
        TV / on-screen display — nothing is faked or silently omitted.
      </p>
      {groups.map(([group, items]) => (
        <section key={group} className="control-group">
          <h3>{group}</h3>
          <ul className="osd-list">
            {items.map((s, i) => (
              <li key={i}>
                <strong>{s.label}</strong>
                <div className="muted">{s.note}</div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
