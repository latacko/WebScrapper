Krok pierwszy:
Wejdź w strone odcinka który chcesz pobrać
<img src="https://github.com/catppuccin/jellyfin/raw/main/assets/latte.webp" />
Krok drugi:
Naciśnij na Pokaż aby zdobyć klucz auth aby ustawić go w .env
<img src="https://github.com/catppuccin/jellyfin/raw/main/assets/latte.webp" />

Utwórz plik .env i uzupełnij go tak:
<br>
login={email}<br>
pass={password}<br>
auth={authKey}<br>

aby uruchomić pobieranie wpisz w konsoli:


node ./dist/index.js --sourceUrl={shindenUrl} --targetPath={Ścieżka gdzie go pobrać}

np:

node ./dist/index.js --sourceUrl=https://shinden.pl/episode/70564-let-s-play-quest-darake-no-my-life/view/253287 --targetPath=C:/Users/llata/Documents/WebScrapper/Videos/