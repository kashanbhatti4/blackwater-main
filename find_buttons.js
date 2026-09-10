const fs = require('fs');
const css = fs.readFileSync('assets/css/webflow.css', 'utf8');

let index = 0;
while (true) {
    index = css.indexOf('var(--_spacing---space--8)', index);
    if (index === -1) break;
    const start = Math.max(0, index - 200);
    const end = Math.min(css.length, index + 200);
    console.log(`Match at ${index}:`);
    console.log(css.substring(start, end));
    index += 1;
}
