import { Router } from 'express';
import { inventoryController } from '../modules/inventory/inventory.controller.js';

export const shortlistRoomRouter: Router = Router();

// Public endpoint to load room details by unique token
shortlistRoomRouter.get('/:token', (req, res, next) => {
  inventoryController.getPublicRoom(req, res, next);
});

// Public endpoint to report buyer engagement telemetry
shortlistRoomRouter.post('/:token/track', (req, res, next) => {
  inventoryController.trackRoomInteraction(req, res, next);
});
