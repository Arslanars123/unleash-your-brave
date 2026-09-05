import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/core/widgets/load_error_view.dart';
import 'package:unleash_your_brave/core/widgets/subpage_app_bar.dart';
import 'package:unleash_your_brave/features/legal/data/datasources/legal_remote_datasource.dart';
import 'package:unleash_your_brave/features/legal/domain/entities/legal_document_entity.dart';
import 'package:url_launcher/url_launcher.dart';

class LegalDocumentPage extends StatefulWidget {
  const LegalDocumentPage({
    super.key,
    required this.kind,
    required this.fallbackTitle,
  });

  final LegalDocumentKind kind;
  final String fallbackTitle;

  factory LegalDocumentPage.privacy({Key? key}) {
    return LegalDocumentPage(
      key: key,
      kind: LegalDocumentKind.privacy,
      fallbackTitle: 'Privacy Policy',
    );
  }

  factory LegalDocumentPage.terms({Key? key}) {
    return LegalDocumentPage(
      key: key,
      kind: LegalDocumentKind.terms,
      fallbackTitle: 'Terms & Conditions',
    );
  }

  @override
  State<LegalDocumentPage> createState() => _LegalDocumentPageState();
}

class _LegalDocumentPageState extends State<LegalDocumentPage> {
  bool _loading = true;
  bool _retrying = false;
  String? _error;
  LoadErrorKind _errorKind = LoadErrorKind.generic;
  LegalDocumentEntity? _document;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool fromRetry = false}) async {
    setState(() {
      if (fromRetry) {
        _retrying = true;
      } else {
        _loading = true;
      }
      _error = null;
    });

    try {
      final document = await sl<LegalRemoteDataSource>().fetch(widget.kind);
      if (!mounted) return;
      if (!document.hasContent || document.bodyHtml.trim().isEmpty) {
        setState(() {
          _loading = false;
          _retrying = false;
          _document = null;
          _errorKind = LoadErrorKind.generic;
          _error = 'No content available right now.';
        });
        return;
      }
      setState(() {
        _document = document;
        _loading = false;
        _retrying = false;
        _error = null;
      });
    } on NetworkException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _retrying = false;
        _document = null;
        _errorKind = LoadErrorKind.offline;
        _error = error.message;
      });
    } on ServerException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _retrying = false;
        _document = null;
        _errorKind = LoadErrorKind.generic;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _retrying = false;
        _document = null;
        _errorKind = LoadErrorKind.generic;
        _error = 'Unable to load this document';
      });
    }
  }

  String get _appBarTitle =>
      _document?.title.trim().isNotEmpty == true
          ? _document!.title
          : widget.fallbackTitle;

  Map<String, Style> get _htmlStyles => {
        'body': Style(
          margin: Margins.zero,
          padding: HtmlPaddings.zero,
          color: AppColors.textSecondary,
          fontSize: FontSize(15),
          lineHeight: const LineHeight(1.55),
        ),
        'p': Style(
          margin: Margins.only(bottom: 14),
          color: AppColors.textSecondary,
        ),
        'h1': Style(
          color: AppColors.textPrimary,
          fontSize: FontSize(22),
          fontWeight: FontWeight.w700,
          margin: Margins.only(top: 8, bottom: 10),
        ),
        'h2': Style(
          color: AppColors.textPrimary,
          fontSize: FontSize(17),
          fontWeight: FontWeight.w700,
          margin: Margins.only(top: 18, bottom: 8),
        ),
        'h3': Style(
          color: AppColors.textPrimary,
          fontSize: FontSize(16),
          fontWeight: FontWeight.w700,
          margin: Margins.only(top: 14, bottom: 6),
        ),
        'strong': Style(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w700,
        ),
        'b': Style(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w700,
        ),
        'a': Style(
          color: AppColors.accentPink,
          textDecoration: TextDecoration.underline,
        ),
        'ul': Style(margin: Margins.only(bottom: 14, left: 8)),
        'ol': Style(margin: Margins.only(bottom: 14, left: 8)),
        'li': Style(
          margin: Margins.only(bottom: 6),
          color: AppColors.textSecondary,
        ),
      };

  Future<void> _onLinkTap(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: buildSubpageAppBar(
        context,
        title: _appBarTitle,
        fallbackLocation: '/profile',
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.accentPink,
              ),
            )
          : _error != null
              ? LoadErrorView(
                  kind: _errorKind,
                  message: _error,
                  retrying: _retrying,
                  onRetry: () => _load(fromRetry: true),
                )
              : AdaptiveScrollBody(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_document!.updated.isNotEmpty)
                        Text(
                          'Last updated ${_document!.updated}',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                      if (_document!.subtitleHtml != null) ...[
                        const SizedBox(height: 12),
                        Html(
                          data: _document!.subtitleHtml!,
                          style: {
                            ..._htmlStyles,
                            'body': Style(
                              margin: Margins.zero,
                              padding: HtmlPaddings.zero,
                              color: AppColors.textSecondary,
                              fontSize: FontSize(14),
                              lineHeight: const LineHeight(1.45),
                            ),
                            'p': Style(
                              margin: Margins.zero,
                              color: AppColors.textSecondary,
                            ),
                          },
                          onLinkTap: (url, _, __) => _onLinkTap(url),
                        ),
                      ],
                      const SizedBox(height: 16),
                      Html(
                        data: _document!.bodyHtml,
                        style: _htmlStyles,
                        onLinkTap: (url, _, __) => _onLinkTap(url),
                      ),
                      const SizedBox(height: 28),
                    ],
                  ),
                ),
    );
  }
}
