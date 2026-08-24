export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
  /**
   * When a failure belongs to one form control, its name — so the caller can
   * render the message against that control rather than in a toast that
   * drifts away from the thing it is talking about.
   */
  field?: string;
}
