import express, { Request, Response, Application } from 'express';
import path from 'path';
import http from 'http';

const app: Application = express();
const server = http.createServer(app);
const port = 5000;

server.listen(port, () => {
	console.log(`Server Running here 👉 https://localhost:${port}`);

	app.get('/public/data2.csv', (_req: Request, res: Response): void => {
		res.sendFile(path.join(path.resolve(), 'public', 'data2.csv'));
	});
});
