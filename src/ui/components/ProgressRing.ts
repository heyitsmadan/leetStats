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

  // The viewBox defines the coordinate system of the SVG. A smaller viewBox makes the content appear smaller.
  const viewBoxWidth = 180;
  const viewBoxHeight = 180;
  const radius = 58; 
  const strokeWidth = 5;
  const centerX = viewBoxWidth / 2;
  const centerY = 80; 

  const totalAngle = 270;
  const startAngle = -135;

  const easyPercent = totalSolved > 0 ? easySolved / totalSolved : 0;
  const mediumPercent = totalSolved > 0 ? mediumSolved / totalSolved : 0;
  const hardPercent = totalSolved > 0 ? hardSolved / totalSolved : 0;

  const easyAngle = easyPercent * totalAngle;
  const mediumAngle = mediumPercent * totalAngle;
  const hardAngle = hardPercent * totalAngle;

  let currentAngle = startAngle;

  const overlap = 1.5; // Slightly increased overlap for thicker stroke

  const easyPath = describeArc(centerX, centerY, radius, currentAngle, currentAngle + easyAngle);
  currentAngle += easyAngle;
  const mediumPath = describeArc(centerX, centerY, radius, currentAngle - overlap, currentAngle + mediumAngle);
  currentAngle += mediumAngle;
  const hardPath = describeArc(centerX, centerY, radius, currentAngle - overlap, currentAngle + hardAngle);

  // The SVG will fill its container, and preserveAspectRatio will scale it without distortion.
  // Clear the container and define SVG namespace
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  const svgNS = "http://www.w3.org/2000/svg";

  // Create SVG element
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('style', 'width: 100%; height: 100%; max-width: 250px; margin: auto;');

  // Create filter definition
  const defs = document.createElementNS(svgNS, 'defs');
  const filter = document.createElementNS(svgNS, 'filter');
  filter.setAttribute('id', 'shadow');
  ['x', 'y'].forEach(attr => filter.setAttribute(attr, '-50%'));
  ['width', 'height'].forEach(attr => filter.setAttribute(attr, '200%'));
  const feDropShadow = document.createElementNS(svgNS, 'feDropShadow');
  feDropShadow.setAttribute('dx', '0');
  feDropShadow.setAttribute('dy', '2');
  feDropShadow.setAttribute('stdDeviation', '4');
  feDropShadow.setAttribute('flood-color', 'rgba(0,0,0,0.2)');
  filter.appendChild(feDropShadow);
  defs.appendChild(filter);
  svg.appendChild(defs);

  // Helper to create path elements
  const createPath = (d: string, stroke: string, hasFilter: boolean) => {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', String(strokeWidth));
    if (hasFilter) {
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('filter', 'url(#shadow)');
    }
    return path;
  };
  
  // Append paths
  svg.appendChild(createPath(describeArc(centerX, centerY, radius, startAngle, startAngle + totalAngle), colors.background.secondarySection, false));
  svg.appendChild(createPath(hardPath, colors.problems.hard, true));
  svg.appendChild(createPath(mediumPath, colors.problems.medium, true));
  svg.appendChild(createPath(easyPath, colors.problems.easy, true));

  // Helper to create text elements
  const createText = (y: number, content: string, style: string, baseline: boolean = true) => {
    const textEl = document.createElementNS(svgNS, 'text');
    textEl.setAttribute('x', String(centerX));
    textEl.setAttribute('y', String(y));
    textEl.setAttribute('fill', colors.text.primary);
    textEl.setAttribute('text-anchor', 'middle');
    if (baseline) textEl.setAttribute('dominant-baseline', 'middle');
    textEl.setAttribute('style', style);
    textEl.textContent = content;
    return textEl;
  };

  // Append text
  svg.appendChild(createText(centerY, String(totalSolved), 'font-size: 2rem; font-weight: 600;'));
  svg.appendChild(createText(centerY + 28, 'solved', 'color: #9ca3af; font-size: 0.9rem;'));
  svg.appendChild(createText(viewBoxHeight - 10, `${totalSubmissions} submissions`, 'font-size: 1rem;', false));

  // Add the completed SVG to the container
  container.appendChild(svg);
}
