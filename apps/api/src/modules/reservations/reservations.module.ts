import { ReservationsService, type ReservationsDatabase } from "./reservations.service";
import { createReservationsController } from "./reservations.controller";

export function createReservationsModule(db: ReservationsDatabase) {
  const service = new ReservationsService(db);
  const controller = createReservationsController(service);

  return {
    service,
    controller,
  };
}
