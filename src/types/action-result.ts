export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}
