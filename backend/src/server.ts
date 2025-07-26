import { createGameServer } from "./createGameServer";

const { httpServer } = createGameServer();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
