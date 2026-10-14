import fs from 'node:fs';
const raw=JSON.parse(fs.readFileSync(new URL('../public/plant-catalog.json',import.meta.url),'utf8'));
const text="// Snapshot copied into new runs, so saves preserve their species allocation rules.\nimport {parsePlantCatalog} from './eco-v2-evolution.js';\nexport const NUTRIENT_SPECIES=parsePlantCatalog("+JSON.stringify(raw)+");\n";
const target=new URL('../src/eco-v2-species-config.ts',import.meta.url);
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==text)throw Error('Species snapshot differs; run this generator');}else fs.writeFileSync(target,text);
console.log('Species snapshot matches catalog');
