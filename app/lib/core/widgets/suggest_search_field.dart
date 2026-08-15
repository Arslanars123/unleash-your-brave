import 'dart:async';

import 'package:flutter/material.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_theme.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';

class SearchSuggestionItem {
  const SearchSuggestionItem({
    required this.id,
    required this.title,
    this.subtitle,
  });

  final String id;
  final String title;
  final String? subtitle;
}

/// Instagram-style search: draft → suggestions → See all / tap commits filter.
class SuggestSearchField extends StatefulWidget {
  const SuggestSearchField({
    super.key,
    required this.controller,
    required this.appliedQuery,
    required this.onAppliedChanged,
    required this.suggestionsFor,
    this.hintText = 'Search',
    this.onSuggestionSelected,
  });

  final TextEditingController controller;
  final String appliedQuery;
  final ValueChanged<String> onAppliedChanged;
  final List<SearchSuggestionItem> Function(String draft) suggestionsFor;
  final String hintText;
  final ValueChanged<SearchSuggestionItem>? onSuggestionSelected;

  @override
  State<SuggestSearchField> createState() => _SuggestSearchFieldState();
}

class _SuggestSearchFieldState extends State<SuggestSearchField> {
  final _focus = FocusNode();
  Timer? _debounce;
  String _draft = '';
  bool _open = false;
  List<SearchSuggestionItem> _suggestions = const [];

  @override
  void initState() {
    super.initState();
    _draft = widget.controller.text;
    _focus.addListener(() {
      setState(() => _open = _focus.hasFocus && _draft.trim().isNotEmpty);
    });
  }

  @override
  void didUpdateWidget(covariant SuggestSearchField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.appliedQuery != oldWidget.appliedQuery &&
        widget.controller.text != widget.appliedQuery &&
        !_focus.hasFocus) {
      widget.controller.text = widget.appliedQuery;
      _draft = widget.appliedQuery;
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() {
      _draft = value;
      _open = _focus.hasFocus && value.trim().isNotEmpty;
    });
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () {
      if (!mounted) return;
      final draft = _draft.trim();
      setState(() {
        _suggestions = draft.isEmpty
            ? const []
            : widget.suggestionsFor(draft).take(6).toList(growable: false);
      });
    });
  }

  void _commit(String value) {
    final next = value.trim();
    widget.controller.text = next;
    widget.controller.selection = TextSelection.collapsed(offset: next.length);
    widget.onAppliedChanged(next);
    setState(() {
      _draft = next;
      _open = false;
    });
    _focus.unfocus();
  }

  void _clear() {
    widget.controller.clear();
    widget.onAppliedChanged('');
    setState(() {
      _draft = '';
      _suggestions = const [];
      _open = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final showPanel = _open && _draft.trim().isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: widget.controller,
          focusNode: _focus,
          onChanged: _onChanged,
          onSubmitted: _commit,
          style: AppTypography.body.copyWith(fontSize: 15, fontWeight: FontWeight.w500),
          cursorColor: AppColors.accentPink,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: widget.hintText,
            hintStyle: AppTypography.caption.copyWith(
              fontWeight: FontWeight.w500,
            ),
            prefixIcon: const Icon(
              Icons.search_rounded,
              color: AppColors.textSecondary,
            ),
            suffixIcon: _draft.isEmpty
                ? null
                : IconButton(
                    onPressed: _clear,
                    icon: const Icon(
                      Icons.close_rounded,
                      color: AppColors.textSecondary,
                    ),
                  ),
            filled: true,
            fillColor: AppColors.bgCard,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(999),
              borderSide: const BorderSide(color: AppColors.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(999),
              borderSide: const BorderSide(color: AppColors.borderSubtle),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(999),
              borderSide: const BorderSide(color: AppColors.accentPink, width: 1.4),
            ),
          ),
        ),
        if (widget.appliedQuery.isNotEmpty) ...[
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.accentPink.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Results for “${widget.appliedQuery}”',
                    style: AppTypography.caption.copyWith(
                      color: AppColors.accentPink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: _clear,
                    child: const Icon(
                      Icons.close_rounded,
                      size: 16,
                      color: AppColors.accentPink,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        if (showPanel) ...[
          const SizedBox(height: 8),
          Material(
            color: AppColors.bgCard,
            elevation: 8,
            shadowColor: Colors.black54,
            borderRadius: BorderRadius.circular(AppTheme.radiusCard),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppTheme.radiusCard),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_suggestions.isEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 18, 16, 10),
                      child: Column(
                        children: [
                          Text(
                            'No matches for “${_draft.trim()}”',
                            style: AppTypography.caption,
                            textAlign: TextAlign.center,
                          ),
                          TextButton(
                            onPressed: () => _commit(_draft),
                            child: Text(
                              'Search anyway',
                              style: AppTypography.button.copyWith(
                                color: AppColors.accentPink,
                                fontSize: 14,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    for (final item in _suggestions)
                      InkWell(
                        onTap: () {
                          widget.onSuggestionSelected?.call(item);
                          _commit(item.title);
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: AppColors.bgMaroon,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: AppColors.borderSubtle),
                                ),
                                child: const Icon(
                                  Icons.search_rounded,
                                  size: 16,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppTypography.body.copyWith(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    if (item.subtitle != null &&
                                        item.subtitle!.isNotEmpty)
                                      Text(
                                        item.subtitle!,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: AppTypography.caption,
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    InkWell(
                      onTap: () => _commit(_draft),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        decoration: const BoxDecoration(
                          border: Border(
                            top: BorderSide(color: AppColors.borderSubtle),
                          ),
                          color: AppColors.bgMaroon,
                        ),
                        child: Text(
                          'See all results for “${_draft.trim()}”',
                          textAlign: TextAlign.center,
                          style: AppTypography.button.copyWith(
                            color: AppColors.accentPink,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
