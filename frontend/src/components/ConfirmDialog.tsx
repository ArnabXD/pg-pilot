import * as AlertDialog from '@radix-ui/react-alert-dialog'

export function ConfirmDialog(props: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AlertDialog.Root open onOpenChange={(o) => !o && props.onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="modal-backdrop" />
        <AlertDialog.Content className="modal">
          <AlertDialog.Title className="modal-title">Confirm</AlertDialog.Title>
          <AlertDialog.Description className="modal-desc">
            {props.message}
          </AlertDialog.Description>
          <div className="modal-actions">
            <AlertDialog.Cancel asChild>
              <button type="button" className="btn" onClick={props.onCancel}>
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="button" className="btn-danger" onClick={props.onConfirm}>
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
