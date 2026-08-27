import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/features/checkin/domain/entities/checkin_form_entity.dart';
import 'package:unleash_your_brave/features/checkin/presentation/widgets/signature_pad.dart';

class CheckInWaiverForm extends StatefulWidget {
  const CheckInWaiverForm({
    super.key,
    required this.form,
    required this.initialSignedName,
    required this.submitting,
    required this.onSubmit,
  });

  final CheckInFormEntity form;
  final String initialSignedName;
  final bool submitting;
  final Future<void> Function({
    required Map<String, dynamic> answers,
    required String signedName,
    required String signatureDataUrl,
  }) onSubmit;

  @override
  State<CheckInWaiverForm> createState() => _CheckInWaiverFormState();
}

class _CheckInWaiverFormState extends State<CheckInWaiverForm> {
  late final SignaturePadController _signature;
  late final TextEditingController _signedName;
  late Map<String, dynamic> _answers;
  late final Map<String, TextEditingController> _textControllers;
  String? _localError;

  @override
  void initState() {
    super.initState();
    _signature = SignaturePadController();
    _signedName = TextEditingController(text: widget.initialSignedName);
    _answers = {};
    _textControllers = {};
    for (final field in widget.form.sortedFields) {
      if (field.type == 'checkbox') {
        _answers[field.id] = false;
      } else if (field.type == 'yes_no') {
        _answers[field.id] = '';
      } else {
        _answers[field.id] = '';
        _textControllers[field.id] = TextEditingController();
      }
    }
  }

  @override
  void dispose() {
    _signature.dispose();
    _signedName.dispose();
    for (final c in _textControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    setState(() => _localError = null);
    final fields = widget.form.sortedFields;

    for (final field in fields) {
      final value = _answers[field.id];
      if (!field.required) continue;
      if (field.type == 'checkbox') {
        if (value != true) {
          setState(() => _localError = '“${field.label}” is required');
          return;
        }
      } else if (value == null || value.toString().trim().isEmpty) {
        setState(() => _localError = '“${field.label}” is required');
        return;
      }
    }

    final name = _signedName.text.trim();
    if (name.isEmpty) {
      setState(() => _localError = 'Signed name is required');
      return;
    }

    if (widget.form.requireSignature && !_signature.hasStroke) {
      setState(() => _localError = 'Signature is required');
      return;
    }

    var signatureDataUrl = '';
    if (widget.form.requireSignature) {
      signatureDataUrl = await _signature.toPngDataUrl() ?? '';
      if (signatureDataUrl.isEmpty) {
        setState(() => _localError = 'Unable to capture signature');
        return;
      }
    }

    final answers = <String, dynamic>{};
    for (final field in fields) {
      final value = _answers[field.id];
      if (field.type == 'yes_no') {
        if (value == true || value == false) {
          answers[field.id] = value;
        } else if (value == 'yes') {
          answers[field.id] = true;
        } else if (value == 'no') {
          answers[field.id] = false;
        } else if (field.required) {
          setState(() => _localError = '“${field.label}” is required');
          return;
        }
      } else if (field.type == 'checkbox') {
        answers[field.id] = value == true;
      } else {
        final text = (value ?? '').toString().trim();
        if (text.isNotEmpty || field.required) {
          answers[field.id] = text;
        }
      }
    }

    await widget.onSubmit(
      answers: answers,
      signedName: name,
      signatureDataUrl: signatureDataUrl,
    );
  }

  @override
  Widget build(BuildContext context) {
    final description = widget.form.description.trim();
    final fields = widget.form.sortedFields;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppTheme.radiusCard),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'WAIVER REQUIRED',
            style: AppTypography.microLabel.copyWith(
              color: AppColors.accentPink,
              letterSpacing: 1.4,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            widget.form.title,
            style: AppTypography.headline.copyWith(fontSize: 22),
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              description,
              style: AppTypography.body.copyWith(
                color: AppColors.textSecondary,
                height: 1.45,
              ),
            ),
          ],
          const SizedBox(height: 20),
          for (final field in fields) ...[
            _buildField(field),
            const SizedBox(height: 14),
          ],
          Text(
            'Full legal name',
            style: AppTypography.microLabel.copyWith(letterSpacing: 1.2),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _signedName,
            style: AppTypography.body,
            decoration: InputDecoration(
              hintText: 'Type your full name',
              filled: true,
              fillColor: AppColors.bgBase,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.borderSubtle),
              ),
            ),
          ),
          if (widget.form.requireSignature) ...[
            const SizedBox(height: 16),
            SignaturePad(controller: _signature),
          ],
          if (_localError != null) ...[
            const SizedBox(height: 12),
            Text(
              _localError!,
              style: AppTypography.caption.copyWith(color: Colors.redAccent),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: widget.submitting ? null : _handleSubmit,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.accentPink,
              foregroundColor: AppColors.bgBase,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: widget.submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.bgBase,
                    ),
                  )
                : Text('Sign & continue', style: AppTypography.button),
          ),
        ],
      ),
    );
  }

  Widget _buildField(CheckInFormFieldEntity field) {
    final label = field.required ? '${field.label} *' : field.label;

    if (field.type == 'checkbox') {
      return CheckboxListTile(
        contentPadding: EdgeInsets.zero,
        value: _answers[field.id] == true,
        activeColor: AppColors.accentPink,
        title: Text(label, style: AppTypography.body.copyWith(fontSize: 14)),
        controlAffinity: ListTileControlAffinity.leading,
        onChanged: (value) {
          setState(() => _answers[field.id] = value == true);
        },
      );
    }

    if (field.type == 'yes_no') {
      final current = _answers[field.id];
      final selected = current == true
          ? 'yes'
          : current == false
              ? 'no'
              : current?.toString() ?? '';
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTypography.body.copyWith(fontSize: 14)),
          const SizedBox(height: 8),
          Row(
            children: [
              ChoiceChip(
                label: const Text('Yes'),
                selected: selected == 'yes',
                selectedColor: AppColors.accentPink,
                onSelected: (_) => setState(() => _answers[field.id] = true),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('No'),
                selected: selected == 'no',
                selectedColor: AppColors.accentPink,
                onSelected: (_) => setState(() => _answers[field.id] = false),
              ),
            ],
          ),
        ],
      );
    }

    final controller = _textControllers[field.id]!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppTypography.body.copyWith(fontSize: 14)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: field.type == 'textarea' ? 4 : 1,
          style: AppTypography.body,
          onChanged: (value) => _answers[field.id] = value,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.bgBase,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.borderSubtle),
            ),
          ),
        ),
      ],
    );
  }
}
