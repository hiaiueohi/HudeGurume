const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),result=JSON.parse(fs.readFileSync(path.join(root,'.runtime','exe-test-result.json'),'utf8'));
if(!result.ok||!result.normalLaunch?.ok)throw Error('Executable checks have not passed.');
const report=[
 '宛名はがき.exe 動作確認結果','確認日：2026年10月18日','',
 '実行ファイル：宛名はがき\\宛名はがき.exe','バージョン：'+result.version,
 '確認環境：このWindows x64 PC','',
 '確認結果：正常',
 '・配布用exeから起動し、同梱されたプログラム・画像を読み込み',
 '・個人登録とCSV取り込みを、同じ住所録に保存',
 '・宛名面の文字・向き・配置の編集、1人／全員への適用',
 '・裏面の選択・文面・配置の編集、元に戻す／やり直す',
 '・ドキュメントへの保存、バックアップ、再読み込み',
 '・完成画像のPNG保存',
 '・はがき100×148mmの印刷指定（仮想プリンターで送信処理を確認）',
 '・二重起動の防止、正常終了',
 '・通常の保存先で起動し、既存の住所録を読み取り',
 '・通常起動テスト前後で、既存住所録の内容が変わっていないことを確認',
 '・書き込み可能なユーザー用フォルダーにログとキャッシュを作成',
 '・通常起動時間：約'+(result.normalLaunch.startupMs/1000).toFixed(1)+'秒（今回の計測）','',
 '補足：',
 'このPCではWindowsのApplication Controlポリシーが1ファイルのポータブル版をブロックしたため、動作確認できたフォルダー同梱版を用意しました。セキュリティ設定は変更していません。',
 'exeだけを移動せず、「宛名はがき」フォルダー全体を保管してください。',
 '実機プリンターの給紙・印字位置は、機種が決まってから試し刷りで確認が必要です。',
 '他のPCのセキュリティポリシーやプリンタードライバーまで確認したものではありません。',''
].join('\r\n');
fs.writeFileSync(path.join(root,'dist','動作確認結果.txt'),report,'utf8');console.log('Build check report saved');
