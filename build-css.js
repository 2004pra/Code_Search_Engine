const tailwindcss = require('@tailwindcss/postcss');
const postcss = require('postcss');
const fs = require('fs');
const path = require('path');

async function buildCss() {
  const input = fs.readFileSync(path.join(__dirname, 'input.css'), 'utf8');
  
  const result = await postcss([
    tailwindcss,
  ]).process(input, {
    from: path.join(__dirname, 'input.css'),
    to: path.join(__dirname, 'public/css/styles.css'),
  });

  const outputDir = path.join(__dirname, 'public', 'css');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, 'styles.css'), result.css);
  console.log('Tailwind CSS built successfully!');
}

buildCss().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
