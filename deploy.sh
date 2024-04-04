[ -d node_modules ] || npm i
kill $(<pid) 2>/dev/null
node . 3000 &>log & echo $! >pid