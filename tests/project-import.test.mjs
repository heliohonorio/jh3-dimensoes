import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSliceInfo, parseGcode, inspectProjectFile } from '../project-import.mjs';

const xml = [
  '<config><plate>',
  '<metadata key="index" value="1"/>',
  '<metadata key="prediction" value="4823"/>',
  '<metadata key="weight" value="18.46"/>',
  '<metadata key="printer_model_id" value="Bambu Lab A1 mini"/>',
  '<filament id="1" used_g="14.21" type="PLA"/>',
  '<filament id="2" used_g="4.25" type="PLA"/>',
  '</plate></config>'
].join('');

test('lê peso, duração, material e impressora no slice_info', () => {
  const result = parseSliceInfo(xml);
  assert.equal(result.grams, 18.46);
  assert.equal(result.seconds, 4823);
  assert.equal(result.material, 'PLA');
  assert.equal(result.printer, 'Bambu Lab A1 mini');
  assert.equal(result.plates, 1);
});

test('soma placas sem multiplicar filamentos erroneamente', () => {
  const result = parseSliceInfo(xml.replace('</config>', '<plate><metadata key="prediction" value="600"/><metadata key="weight" value="2.5"/></plate></config>'));
  assert.equal(result.grams, 20.96);
  assert.equal(result.seconds, 5423);
  assert.equal(result.plates, 2);
});

test('aceita também dados em G-code exportado', () => {
  const header = [
    '; model printing time: 22m 40s; total estimated time: 1h 12m 15s',
    '; total filament weight [g] : 30.25',
    '; printer_model = Bambu Lab A1 mini'
  ].join('\n');
  const result = parseGcode(header);
  assert.equal(result.grams, 30.25);
  assert.equal(result.seconds, 4335);
  assert.equal(result.printer, 'Bambu Lab A1 mini');
});

test('recusa arquivos sem dados de fatiamento', async () => {
  assert.throws(() => parseSliceInfo('<config><header/></config>'));
  assert.throws(() => parseGcode('; G-code sem resumo de filamento'));
  await assert.rejects(() => inspectProjectFile({ name: 'peca.stl', size: 100 }), /STL e OBJ/);
});
