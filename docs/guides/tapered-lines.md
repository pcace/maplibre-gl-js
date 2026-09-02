# Tapered lines (`line-width-start` / `line-width-end`)

## Ziel

Linien sollen eine **Start- und Endbreite** bekommen können, sodass die Breite
kontinuierlich entlang der Linie interpoliert wird (getaperte Linien / "Arrows").

## Hintergrund: Wie MapLibre Lines heute rendert

- Der `LineBucket` (`src/data/bucket/line_bucket.ts`) baut pro Feature ein
  Linien-"Band" aus Dreiecken: Für jeden Vertex werden zwei Halb-Vertices
  (links/rechts) mit einem Extrude-Vektor (`a_data.xy`, skaliert mit 63)
  erzeugt, plus `a_data.z` (Richtung/Kappe) und `linesofar` (Distanz entlang
  der Linie, in `a_data.zw` gepackt).
- Die **Breite** (`line-width`) kommt als **paint property** in den Shader:
  - konstant / zoom-getrieben → **Uniform** (`u_width`)
  - daten-getrieben / composite → **Vertex-Attribut** (`a_width`), pro Feature
    einmal evaluiert und über `ProgramConfiguration` auf alle Vertices gelegt.
- Der Vertex-Shader (`line.vertex.glsl`) rechnet daraus `halfwidth`,
  `inset`/`outset` und `dist = outset * a_extrude * scale`, um die Position des
  Vertex normal zur Linie zu verschieben. `v_width2 = vec2(outset, inset)` ist
  aktuell **`flat`** (pro Dreieck konstant), der Fragment-Shader nutzt es fürs
  Antialiasing (`alpha`).

**Konsequenz:** `line-width` ist pro Feature konstant. Um eine *innerhalb*
einer Linie variierende Breite zu zeichnen, braucht es einen **per-vertex**
Faktor und glatte Interpolation nach dem Fragment-Shader.

## Designentscheidungen

### 1. Zwei neue Paint-Properties: `line-width-start`, `line-width-end`

- Typ `number`, `data-constant`, Zoom-getrieben (interpolierbar), wie
  `line-width`.
- Default `-1` = "nicht gesetzt". Damit ist die Feature-Vollrückwärtskompatibel:
  Ohne die Properties wird exakt der bisherige Codepfad genutzt.
- Nur **eine** gesetzte Property reicht: Die ungesetzte Seite fällt auf
  `line-width` zurück (z. B. nur `line-width-start` setzen → Linie verjüngt
  sich von Startbreite auf normale Breite).
- Beide Werte bleiben **Uniforms** (`u_width_start`/`u_width_end`), also pro
  Feature/Frame — sie können weiterhin Zoom-getrieben oder später auch
  daten-getrieben sein, ohne dass der Taper-Mechanismus sich ändert.

> Warum nicht daten-getrieben pro Vertex in `line-width`? MapLibres
> Expressionsystem hat keinen "per-Vertex"-Kontext (nur pro Feature) und die
> bisherigen Workarounds (Feature in N Segmente zerlegen) kosten Performance
> und erzeugen Rund-Kappen-Artefakte. Ein separater geometrischer Faktor ist
> minimal-invasiv.

### 2. Per-Vertex-Faktor `a_taper` (0..1) im neuen Taper-Buffer

- Der `LineBucket` misst während des Bucketings die kumulative Distanz
  (`taperDistance`) und die Gesamtlänge der Linie (`lineLength`) und schreibt
  für jeden Halb-Vertex `taper = taperDistance / lineLength` in einen
  **eigenen** Vertex-Buffer (`layoutTaperArray`, 1× Float32 pro Vertex).
- Warum ein eigener Buffer statt Platz im vorhandenen `a_data`-Bytepacking?
  - `a_data` ist bereits vollgepackt (x/y-Extrude, Richtung, linesofar) — dort
    fehlt die Präzision (Float32 für den Faktor ist wichtig für glatte
    Interpolation).
  - Der Buffer wird **nur** erzeugt, wenn mindestens eine Taper-Property
    gesetzt ist (`taperEnabled`). Normale Linien zahlen **null** Speicher- oder
    Upload-Overhead.
- `taperDistance` (statt `distance`, das bei sehr langen ungeclippten Linien
  zurücksetzt) bleibt monoton, damit der Faktor auf langen Linien sauber bis 1
  läuft.
- Kappen/Joins erzeugen Duplikat-Vertices außerhalb von 0..1; `mix()` im
  Shader clamped das implizit.

### 3. Shader: neuer `TAPER`-Pfad, `v_width2` wird smooth

- Alle fünf Line-Shader (`line`, `lineGradient`, `lineSDF`, `linePattern`,
  `lineGradientSDF`) bekommen einen `#ifdef TAPER`-Zweig:
  - `in float a_taper;` (keine feste `layout(location)`, wird vom Linker nach
    den Paint-Attributen vergeben)
  - `uniform lowp float u_width_start; uniform lowp float u_width_end;`
  - nach dem `#pragma ... initialize width`: `width = mix(u_width_start,
    u_width_end, a_taper);`
  - `v_width2` wird unter TAPER **smooth** (`out vec2` statt `flat out
    vec2`), im Fragment entsprechend `in` statt `flat in`. Nur der TAPER-Pfad
    interpoliert also — ohne TAPER bleibt alles `flat` und byte-identisch zum
    bisherigen Verhalten.
- `useProgram` unterstützt bereits optionale `defines`; `draw` unterstützt
  bereits **3** dynamische Layout-Buffer (`dynamicLayoutBuffer3`). Beides wird
  ohne weitere API-Änderung wiederverwendet.

### 4. Draw-Pfad (`draw_line.ts`)

- Liest `line-width-start`/`line-width-end` (Zahlen, da `data-constant`).
- Aktiv → `#define TAPER;`, übergibt `[start, end]` an die Uniform-Value-
  Funktionen und `bucket.layoutTaperBuffer` als `dynamicLayoutBuffer3`.
- Inaktiv → identischer Pfad wie vorher.

## Dateien (Änderungen)

| Datei | Änderung |
| --- | --- |
| `build/generate-style-code.ts` | Custom Paint-Specs `line-width-start`/`line-width-end` werden inline in die generierten Properties injiziert (kein Style-Spec-Patch nötig). |
| `build/generate-struct-arrays.ts` | Registriert den neuen `lineTaperLayoutArray`-Typ. |
| `src/data/bucket/line_taper_attributes.ts` | **neu**: `a_taper`-Layout (1× Float32). |
| `src/data/bucket/line_bucket.ts` | Taper-Array/Buffer, `taperEnabled`, Distanz-Messung, `emplaceBack(taper)` in `addHalfVertex`. |
| `src/shaders/glsl/line*.vertex.glsl` (5) | TAPER-Zweig: `a_taper`, Uniforms, `mix`, smooth `v_width2`. |
| `src/shaders/glsl/line*.fragment.glsl` (5) | smooth `v_width2` unter TAPER. |
| `src/webgl/program/line_program.ts` | Optionale Taper-Uniforms in allen Value-Funktionen. |
| `src/webgl/draw/draw_line.ts` | Taper erkennen, Defines setzen, Taper-Buffer binden. |
| `*.g.ts` (generiert) | Neue Properties in `line_style_layer_properties.g.ts`, neue `LineTaperLayoutArray` in `array_types.g.ts`. |

## Performance

- **Kein Overhead** für normale Linien: kein Zusatz-Buffer, kein Zusatz-Attribut,
  `v_width2` bleibt `flat`, keine zusätzlichen Defines/Program-Varianten.
- Nur wenn Taper aktiv ist: +4 Byte/Vertex (Float32), +1 Attribut, +2
  Uniforms, eine `#ifdef`-Programvariante pro Line-Shader.
- Keine CPU-seitige Geometrie-Verdopplung wie beim Segment-Workaround.

## Grenzen / bekannte Einschränkungen

- `line-dasharray` + Taper: Dash-Texel-Koordinaten nutzen `floorwidth`
  (`line-width`), nicht die lokale interpolierte Breite — das Muster skaliert
  nicht mit der verjüngten Breite.
- `line-gap-width` wird nicht per-Vertex interpoliert (bleibt uniform); die
  äußere Kante (outset) verjüngt sich, die Gap bleibt konstant.
- Query/Hit-Breite (`queryRadius`) nutzt weiterhin `line-width` als Näherung.
- Der Faktor ist ein Geometrie-Merkmal des Buckets — er ändert sich nicht,
  wenn nur `line-width-start`/`end` nachträglich animiert werden (gewünscht,
  da die Geometrie unverändert bleibt und die Breiten als Uniforms billig
  variieren).

## Nutzung

```js
map.addLayer({
  id: 'taper',
  type: 'line',
  source: 'route',
  paint: {
    'line-color': '#e11',
    'line-width': 2,          // Endbreite (Fallsback)
    'line-width-start': 16,   // Startbreite
    'line-width-end': 2,      // optional: explizite Endbreite
    'line-cap': 'round'
  }
});
```
