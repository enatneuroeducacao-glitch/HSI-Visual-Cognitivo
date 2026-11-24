export type ExportRow = Record<string, string | number | null | undefined>;
const csvValue=(value:unknown)=>'"'+String(value??'').replace(/"/g,'""')+'"';
const xmlValue=(value:unknown)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function save(name:string,content:string,mime:string){
 const url=URL.createObjectURL(new Blob([content],{type:mime}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function exportReportCsv(filename:string,metadata:Record<string,unknown>,rows:ExportRow[]){
 const keys=rows.length?Object.keys(rows[0]):['Indicador','Valor'];
 const meta=Object.entries(metadata).map(([key,value])=>[key,value] as unknown[]);
 const body=[['METADADOS DO RELATÓRIO',''],...meta,['',''],keys,...rows.map(row=>keys.map(key=>row[key]??''))].map(row=>row.map(csvValue).join(';')).join('\r\n');
 save(filename,'\uFEFF'+body,'text/csv;charset=utf-8;');
}
export function exportReportExcel(filename:string,metadata:Record<string,unknown>,sheets:Array<{name:string;rows:ExportRow[]}>){
 const meta=[['Campo','Descrição'],...Object.entries(metadata)];
 const sheetXml=(name:string,rows:unknown[][])=>'<Worksheet ss:Name="'+xmlValue(name.slice(0,31))+'"><Table>'+rows.map((row,index)=>'<Row>'+row.map(value=>'<Cell'+(index===0?' ss:StyleID="header"':'')+'><Data ss:Type="'+(typeof value==='number'?'Number':'String')+'">'+xmlValue(value)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet>';
 const body='<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#244B70" ss:Pattern="Solid"/></Style></Styles>'+sheetXml('Metodologia',meta)+sheets.map(sheet=>sheetXml(sheet.name,sheet.rows.length?[Object.keys(sheet.rows[0]),...sheet.rows.map(row=>Object.values(row))]:[['Sem dados']])).join('')+'</Workbook>';
 save(filename,body,'application/vnd.ms-excel;charset=utf-8;');
}
