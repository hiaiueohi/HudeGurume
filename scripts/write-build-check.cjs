const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),result=JSON.parse(fs.readFileSync(path.join(root,'.runtime','exe-test-result.json'),'utf8'));
if(!result.ok||!result.normalLaunch?.ok)throw Error('Executable checks have not passed.');
const dateArgument=process.argv.find(value=>value.startsWith('--date='));if(dateArgument&&!/^--date=\d{4}-\d{2}-\d{2}$/.test(dateArgument))throw Error('Use --date=YYYY-MM-DD.');
const checkedAt=dateArgument?new Date(dateArgument.slice(7)+'T12:00:00+09:00'):new Date();
const report=[
 '宛名はがき.exe 動作確認結果','確認日：'+new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric'}).format(checkedAt),'',
 '実行ファイル：宛名はがき\\宛名はがき.exe','バージョン：'+result.version,
 '確認環境：このWindows x64 PC','',
 '確認結果：正常',
 ...(result.postalFrames?.visibleInPrint?['・宛名面の郵便番号枠が印刷時にも7桁分表示され、はがきの寸法が変わらないことを確認']:[]),
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
 ...(result.usability?['・3段階の作成フロー、表裏の同時確認、印刷する面の選択','・検索・宛先の切り替え・印刷対象だけの表示','・矢印での移動・中央揃え・未保存の編集の保護','・印刷する実際のページをプレビュー']:[]),
 '・通常起動時間：約'+(result.normalLaunch.startupMs/1000).toFixed(1)+'秒（今回の計測）','',
 '補足：',
 'このPCではWindowsのApplication Controlポリシーが1ファイルのポータブル版をブロックしたため、動作確認できたフォルダー同梱版を用意しました。セキュリティ設定は変更していません。',
 'exeだけを移動せず、「宛名はがき」フォルダー全体を保管してください。',
 '実機プリンターの給紙・印字位置は、機種が決まってから試し刷りで確認が必要です。',
 '他のPCのセキュリティポリシーやプリンタードライバーまで確認したものではありません。',''
].join('\r\n');
fs.writeFileSync(path.join(root,'.runtime','windows-build','動作確認結果.txt'),report,'utf8');console.log('Build check report saved');
