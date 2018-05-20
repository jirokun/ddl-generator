/**
 * xlsxファイルからDDLを生成する
 * 1行目はヘッダー
 * 2行目以降がカラム定義
 *
 * 各列の定義は下記のとおりにしておく必要がある
 *   tableComment
 *   columnComment
 *   tableName
 *   columnName
 *   columnType
 *   columnPrecision
 *   columnNotNull
 *   columnKey
 */
var fs = require('fs');
var xlsx = require('xlsx');
const utils = xlsx.utils;

function createRowModel(fileName, sheetName) {
  const workbook = xlsx.readFile(fileName);
  const sheet = workbook.Sheets[sheetName];
  const range = utils.decode_range(sheet['!ref']);

  const rows = [];
  const FIELDS = [
    'tableComment',
    'columnComment',
    'tableName',
    'columnName',
    'columnType',
    'columnPrecision',
    'columnNotNull',
    'columnKey',
  ];
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (r === 0) continue; // ヘッダーは飛ばす
    const row = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      let adr = utils.encode_cell({c, r});
      let cell = sheet[adr];
      if (!cell) continue;
      row[FIELDS[c]] = cell.v;
    }
    rows.push(row);
  }
  return rows;
}

function createStructuredModel(rowModel) {
  const model = {};
  for (const row of rowModel) {
    if (!(row.tableName in model)) {
      model[row.tableName] = {
        name: row.tableName,
        comment: row.tableComment,
        fields: []
      };
    }
    const table = model[row.tableName];
    table.fields.push({
      name: row.columnName,
      comment: row.columnComment,
      type: row.columnType,
      precision: row.columnPrecision || '',
      notNull: row.columnNotNull === '1',
      key: row.columnKey || '',
    });
  }
  return model;
}

function generateSQL(model, schema) {
  for (const table in model) {
    let sql = '';
    const fieldSQLs = [];
    sql += `create table ${schema}.${table} (\n`;
    for (const field of model[table].fields) {
      const type = field.type === 'varchar' ? `varchar(${field.precision})` : field.type;
      fieldSQLs.push(`  ${field.name} ${type} ${field.key}`);
    }
    sql += fieldSQLs.join(',\n');
    sql += '\n);\n';

    sql += `COMMENT ON TABLE ${schema}.${table} IS E'${model[table].comment.replace(/\r?\n/g, '\\n')}';\n`;
    for (const field of model[table].fields) {
      sql += `COMMENT ON COLUMN ${schema}.${table}.${field.name} IS E'${field.comment.replace(/\r?\n/g, '\\n')}';\n`;
    }

    console.log(sql);
  }
}

function main(fileName, sheetName, schema) {
  const rowModel = createRowModel(fileName, sheetName);
  const model = createStructuredModel(rowModel);
  generateSQL(model, schema);
}

main('data.xlsx', 'Sheet1', 'tiger');
