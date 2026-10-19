import sharp from 'sharp';
const rows = [['hund','dog'],['katt','cat'],['fjäril','butterfly'],['häst','horse'],['fågel','bird'],['blomma','flower'],['träd','tree'],['hus','house']];
const lines = rows.map(([a,b],i)=>`<text x="80" y="${150+i*70}" font-size="42" font-family="DejaVu Sans, Liberation Sans, sans-serif" fill="#111">${i+1}. ${a}</text><text x="520" y="${150+i*70}" font-size="42" font-family="DejaVu Sans, Liberation Sans, sans-serif" fill="#111">${b}</text>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="760"><rect width="900" height="760" fill="#fff"/><text x="80" y="70" font-size="44" font-weight="bold" font-family="DejaVu Sans, sans-serif">Glosor vecka 43</text>${lines}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(new URL('../e2e/fixtures/wordlist.png', import.meta.url).pathname);
console.log('ok');
