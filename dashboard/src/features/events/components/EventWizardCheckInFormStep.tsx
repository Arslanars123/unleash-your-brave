import {
  type CheckInFormFieldErrors,
  type CheckInFormValues,
} from '@/features/checkin-forms/checkin-form-utils';
import { CheckInFormEditorFields } from '@/features/checkin-forms/components/CheckInFormEditorFields';

interface EventWizardCheckInFormStepProps {
  values: CheckInFormValues;
  errors: CheckInFormFieldErrors;
  disabled?: boolean;
  onChange: (values: CheckInFormValues) => void;
}

export function EventWizardCheckInFormStep({
  values,
  errors,
  disabled = false,
  onChange,
}: EventWizardCheckInFormStepProps) {
  return (
    <div className="wizard-checkin-form-step">
      <p className="hint" style={{ marginTop: 0 }}>
        Every event needs a check-in waiver. Attendees complete this on their phone after staff
        scan their QR. You can edit it later from the Check-in page.
      </p>
      <CheckInFormEditorFields
        values={values}
        errors={errors}
        disabled={disabled}
        lockActive
        onChange={onChange}
      />
    </div>
  );
}
