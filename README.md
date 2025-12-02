Supports (tested): Streamup, Vk, Pixeldrain, Lycoriscafe.
Maybe even more: supports downloading hls, mpd

Krok pierwszy:
Wejdź w strone odcinka który chcesz pobrać
<img src="https://github.com/latacko/WebScrapper/raw/main/firstStep.png" />
Krok drugi:
Naciśnij na Pokaż aby zdobyć klucz auth aby ustawić go w .env
<img src="https://github.com/latacko/WebScrapper/raw/main/secondStep.png" />

Utwórz plik .env i uzupełnij go tak:
<br>
login={email}<br>
pass={password}<br>
auth={authKey}<br>

npm install

następnie wybuduj aplikacje:<br>
npm run build

aby uruchomić pobieranie wpisz w konsoli:


node ./dist/index.js --sourceUrl={shindenUrl} --targetPath={Ścieżka gdzie go pobrać}

np:

node ./dist/index.js --sourceUrl=https://shinden.pl/episode/70564-let-s-play-quest-darake-no-my-life/view/253287 --targetPath=C:/Users/llata/Documents/WebScrapper/Videos/