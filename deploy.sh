[ -d node_modules ] || npm i
kill $(<pid) 2>/dev/null && { echo "old process killed; sleeping for 3 seconds to free up port 3000"; sleep 3; }
node . 3000 &>log & echo $! >pid