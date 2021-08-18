import './style.css';
import pk from '../package.json';

const renderApp = (app) => {
  const main = document.getElementById(app);

  const appNameSplit = pk.name.split('-');
  for (let i = 0; i < appNameSplit.length; i++) {
    appNameSplit[i] = appNameSplit[i][0].toUpperCase() + appNameSplit[i].slice(1);
  }
  const appName = appNameSplit.join(' ');

  main.innerHTML = `
    <strong>${appName}</strong>
  `
  main.style.color = '#3a7b5c';

  return main;
}

renderApp('app');
