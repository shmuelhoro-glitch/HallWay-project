import { ObjectId } from "mongodb";
import QRCode from "qrcode";
import { mongoRepo } from "../repositories/mongoRepo.js";

// GET /api/buildings/:buildingId/qr/:nodeId
// A QR code (SVG picture) with the link <client>/b/<buildingId>?node=<nodeId>.
// A visitor who scans it opens the building with "You are here" on this point.
// Open to everyone (it's only a link), so <img src> can load it without a token.
export async function getQrCode(req, res, next) {
  try {
    const { buildingId, nodeId } = req.params;

    if (!ObjectId.isValid(nodeId)) {
      throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
    }

    const node = await mongoRepo.findOne("nodes", { _id: new ObjectId(nodeId), buildingId });
    if (!node) {
      throw { status: 404, code: "NODE_NOT_FOUND", message: "Node not found" };
    }

    // CLIENT_URL: where the client runs. On the cloud: the real site, for example https://www.shmuelhoro.co.il
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const url = clientUrl + "/b/" + buildingId + "?node=" + nodeId;

    const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 240 });
    res.type("image/svg+xml").send(svg);
  } catch (error) {
    next(error);
  }
}
