[ -d node_modules ] || npm i
[ $1 ] || { echo "Port required"; exit 1; }
kill $(<pid) 2>/dev/null
node . $1 &>log & echo $! >pid