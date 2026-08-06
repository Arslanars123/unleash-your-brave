import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:unleash_your_brave/app/di/injection.dart';
import 'package:unleash_your_brave/core/error/exceptions.dart';
import 'package:unleash_your_brave/core/responsive/responsive.dart';
import 'package:unleash_your_brave/core/theme/app_colors.dart';
import 'package:unleash_your_brave/core/theme/app_typography.dart';
import 'package:unleash_your_brave/core/utils/app_toast.dart';
import 'package:unleash_your_brave/core/utils/media_url.dart';
import 'package:unleash_your_brave/core/utils/validators.dart';
import 'package:unleash_your_brave/core/widgets/adaptive_page.dart';
import 'package:unleash_your_brave/features/auth/data/datasources/uploads_remote_datasource.dart';
import 'package:unleash_your_brave/features/auth/domain/usecases/update_my_profile_usecase.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:unleash_your_brave/features/auth/presentation/widgets/auth_form_fields.dart';

const _networkingOptions = <(String, String)>[
  ('open_to_all', 'Open to all'),
  ('industry_peers', 'Industry peers'),
  ('investors', 'Investors'),
  ('mentors', 'Mentors'),
  ('closed', 'Closed'),
];

class EditProfilePage extends StatefulWidget {
  const EditProfilePage({super.key});

  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _picker = ImagePicker();

  late final TextEditingController _nameController;
  late final TextEditingController _titleController;
  late final TextEditingController _businessController;
  late final TextEditingController _industryController;
  late final TextEditingController _locationController;
  late final TextEditingController _bioController;
  late final TextEditingController _goalsController;
  late final TextEditingController _interestsController;
  late final TextEditingController _linkedinController;
  late final TextEditingController _instagramController;
  late final TextEditingController _websiteController;

  String _photoUrl = '';
  String _networkingPrefs = 'open_to_all';
  bool _saving = false;
  bool _uploadingPhoto = false;
  File? _localPhoto;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthBloc>().state;
    final user = auth is AuthAuthenticated ? auth.user : null;

    _nameController = TextEditingController(text: user?.name ?? '');
    _titleController = TextEditingController(text: user?.title ?? '');
    _businessController = TextEditingController(text: user?.business ?? '');
    _industryController = TextEditingController(text: user?.industry ?? '');
    _locationController = TextEditingController(text: user?.location ?? '');
    _bioController = TextEditingController(text: user?.bio ?? '');
    _goalsController =
        TextEditingController(text: user?.goals.join(', ') ?? '');
    _interestsController =
        TextEditingController(text: user?.interests.join(', ') ?? '');
    _linkedinController = TextEditingController(text: user?.linkedinUrl ?? '');
    _instagramController =
        TextEditingController(text: user?.instagramUrl ?? '');
    _websiteController = TextEditingController(text: user?.websiteUrl ?? '');
    _photoUrl = user?.photoUrl ?? '';
    _networkingPrefs = user?.networkingPrefs ?? 'open_to_all';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _titleController.dispose();
    _businessController.dispose();
    _industryController.dispose();
    _locationController.dispose();
    _bioController.dispose();
    _goalsController.dispose();
    _interestsController.dispose();
    _linkedinController.dispose();
    _instagramController.dispose();
    _websiteController.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (picked == null) return;

      setState(() {
        _localPhoto = File(picked.path);
        _uploadingPhoto = true;
      });

      final url = await sl<UploadsRemoteDataSource>().uploadImage(_localPhoto!);
      if (!mounted) return;
      setState(() {
        _photoUrl = url;
        _uploadingPhoto = false;
      });
      AppToast.success('Photo uploaded');
    } catch (error) {
      if (!mounted) return;
      setState(() => _uploadingPhoto = false);
      final message = switch (error) {
        ServerException(:final message) => message,
        NetworkException(:final message) => message,
        _ => 'Unable to upload photo',
      };
      AppToast.error(message);
    }
  }

  void _showPhotoSheet() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose from library'),
                onTap: () {
                  Navigator.pop(context);
                  _pickPhoto(ImageSource.gallery);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Take a photo'),
                onTap: () {
                  Navigator.pop(context);
                  _pickPhoto(ImageSource.camera);
                },
              ),
              if (_photoUrl.isNotEmpty || _localPhoto != null)
                ListTile(
                  leading: const Icon(Icons.delete_outline),
                  title: const Text('Remove photo'),
                  onTap: () {
                    Navigator.pop(context);
                    setState(() {
                      _localPhoto = null;
                      _photoUrl = '';
                    });
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  List<String> _splitTags(String raw) {
    return raw
        .split(RegExp(r'[,;\n]'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }

  Future<void> _save() async {
    if (_saving || _uploadingPhoto) return;
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final payload = <String, dynamic>{
      'name': _nameController.text.trim(),
      'photoUrl': _photoUrl,
      'title': _titleController.text.trim(),
      'business': _businessController.text.trim(),
      'industry': _industryController.text.trim(),
      'location': _locationController.text.trim(),
      'bio': _bioController.text.trim(),
      'goals': _splitTags(_goalsController.text),
      'interests': _splitTags(_interestsController.text),
      'networkingPrefs': _networkingPrefs,
      'linkedinUrl': _linkedinController.text.trim(),
      'instagramUrl': _instagramController.text.trim(),
      'websiteUrl': _websiteController.text.trim(),
      'profileCompleted': true,
    };

    setState(() => _saving = true);

    final result = await sl<UpdateMyProfileUseCase>()(
      UpdateMyProfileParams(payload),
    );

    if (!mounted) return;

    result.fold(
      (failure) {
        setState(() => _saving = false);
        AppToast.error(failure.message);
      },
      (user) {
        context.read<AuthBloc>().add(AuthUserUpdated(user));
        setState(() => _saving = false);
        AppToast.success('Profile updated');
        context.pop();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        backgroundColor: AppColors.bgBase,
        elevation: 0,
        title: Text(
          'Edit profile',
          style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: _saving ? null : () => context.pop(),
        ),
      ),
      body: AdaptiveScrollBody(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _PhotoEditor(
                photoUrl: _photoUrl,
                localPhoto: _localPhoto,
                uploading: _uploadingPhoto,
                onTap: _uploadingPhoto ? null : _showPhotoSheet,
              ),
              SizedBox(height: context.sectionGap),
              AuthTextField(
                controller: _nameController,
                label: 'Full name',
                textInputAction: TextInputAction.next,
                validator: Validators.name,
                prefixIcon: Icons.person_outline,
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _titleController,
                label: 'Title',
                textInputAction: TextInputAction.next,
                prefixIcon: Icons.badge_outlined,
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _businessController,
                label: 'Business',
                textInputAction: TextInputAction.next,
                prefixIcon: Icons.business_outlined,
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _industryController,
                label: 'Industry',
                textInputAction: TextInputAction.next,
                prefixIcon: Icons.category_outlined,
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _locationController,
                label: 'Location',
                textInputAction: TextInputAction.next,
                prefixIcon: Icons.place_outlined,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: _bioController,
                maxLines: 4,
                textInputAction: TextInputAction.newline,
                style: AppTypography.body,
                decoration: InputDecoration(
                  labelText: 'Bio',
                  labelStyle: AppTypography.caption,
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _goalsController,
                label: 'Goals (comma-separated)',
                textInputAction: TextInputAction.next,
                prefixIcon: Icons.flag_outlined,
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _interestsController,
                label: 'Interests (comma-separated)',
                textInputAction: TextInputAction.next,
                prefixIcon: Icons.interests_outlined,
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                key: ValueKey(_networkingPrefs),
                initialValue: _networkingPrefs,
                decoration: InputDecoration(
                  labelText: 'Networking preference',
                  labelStyle: AppTypography.caption,
                ),
                items: [
                  for (final option in _networkingOptions)
                    DropdownMenuItem(
                      value: option.$1,
                      child: Text(option.$2),
                    ),
                ],
                onChanged: _saving
                    ? null
                    : (value) {
                        if (value == null) return;
                        setState(() => _networkingPrefs = value);
                      },
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _linkedinController,
                label: 'LinkedIn URL',
                keyboardType: TextInputType.url,
                textInputAction: TextInputAction.next,
                prefixIcon: Icons.link,
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _instagramController,
                label: 'Instagram URL',
                keyboardType: TextInputType.url,
                textInputAction: TextInputAction.next,
                prefixIcon: Icons.link,
              ),
              const SizedBox(height: 14),
              AuthTextField(
                controller: _websiteController,
                label: 'Website URL',
                keyboardType: TextInputType.url,
                textInputAction: TextInputAction.done,
                prefixIcon: Icons.language,
                onFieldSubmitted: (_) => _save(),
              ),
              SizedBox(height: context.sectionGap),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: (_saving || _uploadingPhoto) ? null : _save,
                  child: _saving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save profile'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PhotoEditor extends StatelessWidget {
  const _PhotoEditor({
    required this.photoUrl,
    required this.localPhoto,
    required this.uploading,
    required this.onTap,
  });

  final String photoUrl;
  final File? localPhoto;
  final bool uploading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final remote = resolveMediaUrl(photoUrl);
    ImageProvider? image;
    if (localPhoto != null) {
      image = FileImage(localPhoto!);
    } else if (isLoadableMediaUrl(photoUrl)) {
      image = NetworkImage(remote);
    }

    return Center(
      child: GestureDetector(
        onTap: onTap,
        child: Stack(
          alignment: Alignment.bottomRight,
          children: [
            CircleAvatar(
              radius: 52,
              backgroundColor: AppColors.accentPink.withValues(alpha: 0.15),
              backgroundImage: uploading ? null : image,
              child: uploading
                  ? const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : image == null
                      ? const Icon(
                          Icons.person_outline,
                          size: 40,
                          color: AppColors.accentPink,
                        )
                      : null,
            ),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.bgCard,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: const Icon(Icons.camera_alt_outlined, size: 16),
            ),
          ],
        ),
      ),
    );
  }
}
