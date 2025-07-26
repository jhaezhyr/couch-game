import { createGameServer } from "./createGameServer";

const { httpServer } = createGameServer();

const PORT = process.env.PORT || 3010;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
