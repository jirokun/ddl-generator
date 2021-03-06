/**
 * xlsxファイルからDDLを生成する
 * 1行目はヘッダー
 * 2行目以降がカラム定義
 *
 * 各列の定義は下記のとおりにしておく必要がある
 *   tableComment
 *   columnCommentJ
 *   tableName
 *   columnName
 *   columnType
 *   columnPrecision
 *   columnNN
 *   columnPK
 *   columnFK
 *   columnUK1
 *   columnUK2
 *   columnUK3
 *   columnIDX1
 *
 * 使い方: node app.js <xlsx file> <sheet name> <schema>
 */
var fs = require('fs');
var process = require('process');
var xlsx = require('xlsx');
var ejs = require('ejs');

const utils = xlsx.utils;

function createRowModel(fileName, sheetName) {
  const workbook = xlsx.readFile(fileName);
  const sheet = workbook.Sheets[sheetName];
  const range = utils.decode_range(sheet['!ref']);

  const rows = [];
  const FIELDS = [
    'tableNameJ',
    'tableCommentJ',
    'columnNameJ',
    'columnCommentJ',
    'tableName',
    'columnName',
    'columnType',
    'columnPrecision',
    'columnNN',
    'columnPK',
    'columnFK',
    'columnUK1',
    'columnUK2',
    'columnUK3',
    'columnIDX1',
    'defaultValue',
    'checkConstraint',
    'data1',
    'data2',
    'data3',
    'data4',
    'data5',
    'data6',
    'data7',
    'data8',
    'data9',
    'data10',
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
  const model = createFields(rowModel);
  buildIndex(model);
  buildData(model);
  return model;
}

function buildData(model) {
  for (tableName in model) {
    const table = model[tableName];
    table.dataList = [];
    for (let i = 0; i < 10; i++) {
      const key = `data${i + 1}`;
      const data = {};
      table.fields.forEach((field, index) => {
        if (field[key] === undefined) return;
        data[field.name] = field[key];
      });
      if (data.id) {
        table.dataList.push(data);
      }
    }
  }
}

function buildIndex(model) {
  for (tableName in model) {
    const table = model[tableName];
    ['uk1', 'uk2', 'uk3', 'idx1'].forEach((keyName) => {
      const key = [];
      table.fields.forEach((field) => {
        if (!field[keyName]) return;
        key[parseInt(field[keyName], 10) - 1] = field;
      });
      if (key.length !== 0) {
        table[keyName] = key;
      }
    });
  }
  return model;
}

function createFields(rowModel) {
  const model = {};
  // tableとfieldsの作成
  for (const row of rowModel) {
    if (!(row.tableName in model)) {
      model[row.tableName] = {
        name: row.tableName,
        comment: row.tableNameJ + (row.tableCommentJ ? `\n\n${row.tableCommentJ}` : ''),
        fields: []
      };
    }
    const table = model[row.tableName];
    table.fields.push({
      name: row.columnName,
      comment: row.columnNameJ + (row.columnCommentJ ? `\n\n${row.columnCommentJ}` : ''),
      type: row.columnType,
      dbType: dbType(row),
      precision: row.columnPrecision || '',
      nn: row.columnNN == '1',
      pk: row.columnPK == '1',
      fk: row.columnFK,
      uk1: row.columnUK1,
      uk2: row.columnUK2,
      uk3: row.columnUK3,
      idx1: row.columnIDX1 || '',
      defaultValue: row.defaultValue,
      checkConstraint: row.checkConstraint,
      data1: row.data1,
      data2: row.data2,
      data3: row.data3,
      data4: row.data4,
      data5: row.data5,
      data6: row.data6,
      data7: row.data7,
      data8: row.data8,
      data9: row.data9,
      data10: row.data10,
    });
  }
  return model;
}

function dbType(row) {
  if (row.columnType === 'varchar') return `varchar(${row.columnPrecision})`;
  return row.columnType;
}

function generateSQL(model, schema) {
  console.log('begin;');
  for (const tableName in model) {
    const table = model[tableName];
    if (!table.name) continue;
    var ddl = ejs.render(fs.readFileSync('sql.tmpl', 'utf8'), { table, schema });
    console.log(ddl);
  }
  console.log('commit;');
}

function main(fileName, sheetName, schema) {
  const rowModel = createRowModel(fileName, sheetName);
  const model = createStructuredModel(rowModel);
  generateSQL(model, schema);
}

main(process.argv[2], process.argv[3], process.argv[4]);
