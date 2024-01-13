[ ! -d node_modules ] && npm i
[ ! $1 ] && (echo "Port required"; exit 1)
node . $1 &>log & echo $! >pid