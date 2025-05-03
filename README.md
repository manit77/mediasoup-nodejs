# Mediasoup Demo

## Instructions

1. install nodejs
2. install ts-node globally
3. git clone https://github.com/manit77/mediasoup-nodejs.git
4. cd mediasoup-nodejs
5. npm install
6. cd ../public
7. npm install
8. cd ../
9. npm start
10. open browser to https://localhost:3000

## editing main.js requires bundling the js file to an esm module
1. edit main.js as needed
2. bundle main.js to bundle.js
3. npx esbuild main.js --bundle --outfile=bundle.js --format=esm

## download ffmpeg
- https://www.ffmpeg.org/download.html
- copy the ffmpeg executable to the bin folder
