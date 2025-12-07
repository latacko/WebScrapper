Supports (tested): Streamup, Vk, Lycoriscafe.
Maybe even more: supports downloading hls, mpd but add to favoritesPlayers in index.ts:28

Utwórz plik .env i uzupełnij go tak:
<br>
login={email}<br>
pass={password}<br>

npm install

następnie wybuduj aplikacje:<br>
npm run build

aby uruchomić pobieranie wpisz w konsoli:


node ./dist/index.js --sourceUrl={shindenUrl} --targetPath={Ścieżka gdzie go pobrać}

np:

node ./dist/index.js --sourceUrl=https://shinden.pl/series/70564-let-s-play-quest-darake-no-my-life/episodes --targetPath=C:/Users/llata/Documents/WebScrapper/Videos/LetsPlay/