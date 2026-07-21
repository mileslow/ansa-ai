const streamExcludedElements = new Set([
  "script",
  "style",
  "svg",
  "title",
  "noscript",
  "textarea",
]);

const streamStyle = `
<style data-ansa-text-stream>
  .ansa-stream-word {
    opacity: 0;
    animation: ansa-stream-word-in 140ms cubic-bezier(.22, 1, .36, 1) forwards;
    animation-delay: var(--ansa-stream-delay);
  }
  .ansa-stream-word--last::after {
    width: 2px;
    height: .9em;
    display: inline-block;
    margin-left: 2px;
    vertical-align: -.08em;
    background: #2563eb;
    content: "";
    animation: ansa-stream-caret 900ms ease-out forwards;
    animation-delay: var(--ansa-stream-delay);
  }
  @keyframes ansa-stream-word-in {
    from { opacity: 0; filter: blur(1px); }
    to { opacity: 1; filter: blur(0); }
  }
  @keyframes ansa-stream-caret {
    0%, 8% { opacity: 0; }
    12%, 65% { opacity: 1; }
    100% { opacity: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ansa-stream-word { opacity: 1; animation: none; }
    .ansa-stream-word--last::after { display: none; animation: none; }
  }
</style>`;

function tagEnd(html, start) {
  let quote = "";
  for (let index = start + 1; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === ">") return index;
  }
  return html.length - 1;
}

function mapVisibleHtmlText(html, mapText) {
  const lowerHtml = html.toLowerCase();
  let result = "";
  let cursor = 0;
  while (cursor < html.length) {
    const nextTag = html.indexOf("<", cursor);
    if (nextTag === -1) {
      result += mapText(html.slice(cursor));
      break;
    }
    if (nextTag > cursor) result += mapText(html.slice(cursor, nextTag));
    if (html.startsWith("<!--", nextTag)) {
      const commentEnd = html.indexOf("-->", nextTag + 4);
      const end = commentEnd === -1 ? html.length : commentEnd + 3;
      result += html.slice(nextTag, end);
      cursor = end;
      continue;
    }
    const end = tagEnd(html, nextTag);
    const tag = html.slice(nextTag, end + 1);
    result += tag;
    cursor = end + 1;
    const opening = tag.match(/^<\s*([a-z][\w:-]*)\b/i);
    if (!opening || /\/\s*>$/.test(tag)) continue;
    const element = opening[1].toLowerCase();
    if (!streamExcludedElements.has(element)) continue;
    const closeStart = lowerHtml.indexOf(`</${element}`, cursor);
    if (closeStart === -1) {
      result += html.slice(cursor);
      break;
    }
    result += html.slice(cursor, closeStart);
    cursor = closeStart;
  }
  return result;
}

function visibleHtmlWords(html) {
  const words = [];
  mapVisibleHtmlText(html, (text) => {
    words.push(...(text.match(/\S+/g) || []));
    return text;
  });
  return words;
}

function streamWordsEqual(left, right) {
  if (left === right) return true;
  const comparable = (value) => value.replace(/^[^\w$%]+|[^\w$%]+$/g, "");
  const normalizedLeft = comparable(left);
  const normalizedRight = comparable(right);
  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

function changedCurrentWordIndexes(previousWords, currentWords) {
  let prefix = 0;
  while (
    prefix < previousWords.length &&
    prefix < currentWords.length &&
    streamWordsEqual(previousWords[prefix], currentWords[prefix])
  ) prefix += 1;
  let suffix = 0;
  while (
    suffix < previousWords.length - prefix &&
    suffix < currentWords.length - prefix &&
    streamWordsEqual(
      previousWords[previousWords.length - suffix - 1],
      currentWords[currentWords.length - suffix - 1],
    )
  ) suffix += 1;
  const previousMiddle = previousWords.slice(prefix, previousWords.length - suffix);
  const currentMiddle = currentWords.slice(prefix, currentWords.length - suffix);
  if (!currentMiddle.length) return new Set();
  if (!previousMiddle.length)
    return new Set(currentMiddle.map((_, index) => prefix + index));

  // The usual page update is a short paragraph replacement. LCS keeps
  // unchanged words inside that replacement visible while only new copy
  // receives the stream animation. Very large rewrites use the bounded
  // middle range instead of allocating an unbounded comparison matrix.
  if (previousMiddle.length * currentMiddle.length > 1_500_000)
    return new Set(currentMiddle.map((_, index) => prefix + index));
  const matrix = Array.from(
    { length: previousMiddle.length + 1 },
    () => new Uint16Array(currentMiddle.length + 1),
  );
  for (let left = 1; left <= previousMiddle.length; left += 1) {
    for (let right = 1; right <= currentMiddle.length; right += 1) {
      matrix[left][right] = streamWordsEqual(
        previousMiddle[left - 1],
        currentMiddle[right - 1],
      )
        ? matrix[left - 1][right - 1] + 1
        : Math.max(matrix[left - 1][right], matrix[left][right - 1]);
    }
  }
  const unchanged = new Set();
  let left = previousMiddle.length;
  let right = currentMiddle.length;
  while (left > 0 && right > 0) {
    if (streamWordsEqual(previousMiddle[left - 1], currentMiddle[right - 1])) {
      unchanged.add(prefix + right - 1);
      left -= 1;
      right -= 1;
    } else if (matrix[left - 1][right] >= matrix[left][right - 1]) left -= 1;
    else right -= 1;
  }
  return new Set(
    currentMiddle
      .map((_, index) => prefix + index)
      .filter((index) => !unchanged.has(index)),
  );
}

export function bookletTextStreamChangedWordCount(html, previousHtml = "") {
  const currentWords = visibleHtmlWords(String(html || ""));
  const previousWords = visibleHtmlWords(String(previousHtml || ""));
  return changedCurrentWordIndexes(previousWords, currentWords).size;
}

export function bookletTextStreamShouldAnimate(changedWordCount, hasPreviousHtml) {
  return changedWordCount >= (hasPreviousHtml ? 4 : 8);
}

export function bookletTextStreamDuration(htmlOrWordCount) {
  const wordCount = typeof htmlOrWordCount === "number"
    ? htmlOrWordCount
    : visibleHtmlWords(String(htmlOrWordCount || "")).length;
  return Math.max(1400, Math.min(5200, Math.round(wordCount * 28)));
}

export function createBookletTextStreamHtml(html, previousHtml = "") {
  const source = String(html || "");
  const currentWords = visibleHtmlWords(source);
  const changedIndexes = changedCurrentWordIndexes(
    visibleHtmlWords(String(previousHtml || "")),
    currentWords,
  );
  const changedWordCount = changedIndexes.size;
  if (!changedWordCount) return source;
  const duration = bookletTextStreamDuration(changedWordCount);
  const delayStep = changedWordCount > 1
    ? (duration - 180) / (changedWordCount - 1)
    : 0;
  let wordIndex = 0;
  let changedWordIndex = 0;
  const streamed = mapVisibleHtmlText(source, (text) =>
    text.split(/(\s+)/).map((part) => {
      if (!/\S/.test(part)) return part;
      const changed = changedIndexes.has(wordIndex);
      wordIndex += 1;
      if (!changed) return part;
      const delay = Math.round(changedWordIndex * delayStep);
      const last = changedWordIndex === changedWordCount - 1;
      changedWordIndex += 1;
      return `<span class="ansa-stream-word${last ? " ansa-stream-word--last" : ""}" data-ansa-stream-word="${changedWordIndex}" data-ansa-source-word="${wordIndex}" style="--ansa-stream-delay:${delay}ms">${part}</span>`;
    }).join(""),
  );
  if (/<\/head\s*>/i.test(streamed))
    return streamed.replace(/<\/head\s*>/i, `${streamStyle}</head>`);
  const htmlTag = streamed.match(/<html\b[^>]*>/i)?.[0];
  if (htmlTag)
    return streamed.replace(htmlTag, `${htmlTag}<head>${streamStyle}</head>`);
  return `${streamStyle}${streamed}`;
}
