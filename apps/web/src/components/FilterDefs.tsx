import { filterMatrices } from '@/features/edit/filters';

/**
 * The app's color filters as SVG filters (FR-CAP-04; rule 8: color only). feColorMatrix takes the same
 * row-major 4×5 matrix as Skia's ColorMatrix, so a photo looks the same here as in the app.
 */
export function FilterDefs() {
  return (
    <svg aria-hidden width={0} height={0} style={{ position: 'absolute' }}>
      {Object.entries(filterMatrices).map(([id, m]) => (
        <filter key={id} id={`filter-${id}`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={m.join(' ')} />
        </filter>
      ))}
    </svg>
  );
}
