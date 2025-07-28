import { colors } from '../theme/colors';
import type { SolvedStats } from '../../analysis/stats/getSolvedStats';
import { styles } from '../theme/styles';

/**
 * Converts polar coordinates (angle, radius) to Cartesian coordinates (x, y).
 * The coordinate system is adjusted so that 0 degrees is at the top of the circle.
 * @param centerX The x-coordinate of the center of the circle.
 * @param centerY The y-coordinate of the center of the circle.
 * @param radius The radius of the circle.
 * @param angleInDegrees The angle in degrees.
 * @returns An object with x and y properties.
 */
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

/**
 * Generates the SVG path data for a clockwise arc.
 * @param x The x-coordinate of the center of the circle.
 * @param y The y-coordinate of the center of the circle.
 * @param radius The radius of the circle.
 * @param startAngle The starting angle of the arc in degrees.
 * @param endAngle The ending angle of the arc in degrees.
 * @returns The SVG path string for the arc.
 */
function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number): string {
  // Prevent path errors for zero-length arcs
  if (startAngle === endAngle) {
    return "";
  }
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  // The '1' for the sweep-flag ensures the arc is drawn clockwise.
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

/**
 * Renders a semi-circular progress ring SVG into a container element.
 * The SVG is designed to be responsive and scale to its container's size.
 * @param container The HTMLElement to render the SVG into.
 * @param data The stats data used to calculate the ring segments and text.
 */
export function renderProgressRing(container: HTMLElement, data: SolvedStats): void {
  const { totalSolved, easySolved, mediumSolved, hardSolved, totalSubmissions } = data;

  // The viewBox is made smaller to "hug" the content and reduce padding.
  const viewBoxWidth = 220;
  const viewBoxHeight = 220;
  const radius = 70; // Radius is reduced to shrink the ring
  const strokeWidth = 5;
  const centerX = viewBoxWidth / 2;
  const centerY = 95; // Center point is adjusted for the new viewBox

  const totalAngle = 270;
  const startAngle = -135;

  const easyPercent = totalSolved > 0 ? easySolved / totalSolved : 0;
  const mediumPercent = totalSolved > 0 ? mediumSolved / totalSolved : 0;
  const hardPercent = totalSolved > 0 ? hardSolved / totalSolved : 0;

  const easyAngle = easyPercent * totalAngle;
  const mediumAngle = mediumPercent * totalAngle;
  const hardAngle = hardPercent * totalAngle;

  let currentAngle = startAngle;

  // Overlap by a small degree to blend the rounded caps smoothly
  const overlap = 1;

  // Calculate the path for each difficulty segment
  const easyPath = describeArc(centerX, centerY, radius, currentAngle, currentAngle + easyAngle);
  currentAngle += easyAngle;
  const mediumPath = describeArc(centerX, centerY, radius, currentAngle - overlap, currentAngle + mediumAngle);
  currentAngle += mediumAngle;
  const hardPath = describeArc(centerX, centerY, radius, currentAngle - overlap, currentAngle + hardAngle);

  // Inject the complete SVG into the container
  container.innerHTML = `
    <svg viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" style="width: 100%; height: auto; max-width: ${viewBoxWidth}px;">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.2)" />
        </filter>
      </defs>
      
      <!-- Background Ring (optional, for context) -->
      <path d="${describeArc(centerX, centerY, radius, startAngle, startAngle + totalAngle)}" fill="none" stroke="${colors.background.secondarySection}" stroke-width="${strokeWidth}" />

      <!-- Draw paths in reverse order so overlaps look correct with rounded caps -->
      <path d="${hardPath}" fill="none" stroke="${colors.problems.hard}" stroke-width="${strokeWidth}" stroke-linecap="round" filter="url(#shadow)" />
      <path d="${mediumPath}" fill="none" stroke="${colors.problems.medium}" stroke-width="${strokeWidth}" stroke-linecap="round" filter="url(#shadow)" />
      <path d="${easyPath}" fill="none" stroke="${colors.problems.easy}" stroke-width="${strokeWidth}" stroke-linecap="round" filter="url(#shadow)" />
      
      <!-- Centered Text Block -->
      <text x="${centerX}" y="${centerY}" fill="${colors.text.primary}" text-anchor="middle" dominant-baseline="middle" style="font-size: 2.5rem; font-weight: 600;">${totalSolved}</text>
      <text x="${centerX}" y="${centerY + 35}" fill="${colors.text.primary}" text-anchor="middle" dominant-baseline="middle" style="color: #9ca3af; font-size: 1rem;">${"solved"}</text>
      
      <!-- Submissions text at the bottom of the SVG canvas -->
      <text x="${centerX}" y="${viewBoxHeight - 15}" fill="${colors.text.primary}" text-anchor="middle" style="font-size: 1.25rem;">${totalSubmissions} submissions</text>
    </svg>
  `;
}
