
const XLSX = require('xlsx');
const SUBJECT_COLUMNS = ['MATHEMATICS','ENGLISH','SCIENCE','SOCIAL STUDIES','ZAMBIAN LANGUAGE','SPECIAL PAPER 1','SPECIAL PAPER 2','TECHNOLOGY STUDIES','HOME ECONOMICS','EXPRESSIVE ARTS'];
const learners = [['Kabwe Mulenga','45','52','48','50','47','49','44','46','51','61'],
                  ['Lubosi Chama','38','41','35','40','39','42','37','40','36','66']];
const headers = ['S/N','NAME',...SUBJECT_COLUMNS,'TOTAL','POSITION'];
const rows = [headers];
learners.forEach((l, i) => {
  const rowNum = i + 2;
  rows.push([i+1, l[0], ...l.slice(1), {f:`SUM(C${rowNum}:L${rowNum})`}, '']);
});
const last = learners.length + 1;
const avg = ['', 'Average'];
for (let j = 0; j < 10; j++) {
  const col = String.fromCharCode(67 + j);
  avg.push({f:`IFERROR(AVERAGE(${col}2:${col}${last}),0)`});
}
avg.push('',''); rows.push(avg);
const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Term 1');
XLSX.writeFile(wb, '/tmp/test-mark-sheet.xlsx');
console.log('xlsx written');
