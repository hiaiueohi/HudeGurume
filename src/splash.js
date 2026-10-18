const statusNode = document.querySelector('#launchStatus');
window.setLaunchStage = stage => {
  if (stage === 'loading') statusNode.textContent = 'コーヒーカップがふわふわと浮かんでいます。';
  if (stage === 'ready') {
    document.body.classList.add('ready');
    statusNode.textContent = '住所録の準備ができました。';
  }
  if (stage === 'leaving') document.body.classList.add('leaving');
};
document.querySelector('#closeSplash').onclick = () => window.close();
