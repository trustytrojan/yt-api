import express from 'express';
const app = express();
app.get('/test', (req, res) => {
	console.log(req.query);
	res.sendStatus(200);
});
app.listen(3030);