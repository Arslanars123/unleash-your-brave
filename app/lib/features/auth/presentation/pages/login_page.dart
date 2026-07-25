import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'member@unleashyourbrave.com');
  final _passwordController = TextEditingController(text: 'Member123!');
  bool _isRegister = false;
  final _nameController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    final bloc = context.read<AuthBloc>();
    if (_isRegister) {
      bloc.add(
        AuthRegisterRequested(
          email: _emailController.text.trim(),
          name: _nameController.text.trim(),
          password: _passwordController.text,
        ),
      );
    } else {
      bloc.add(
        AuthLoginRequested(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthAuthenticated) {
            context.go('/');
          } else if (state is AuthFailureState) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(state.message)),
            );
          }
        },
        builder: (context, state) {
          final loading = state is AuthLoading;

          return SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          width: 64,
                          height: 64,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(18),
                            gradient: const LinearGradient(
                              colors: [Color(0xFFEA580C), Color(0xFF9A3412)],
                            ),
                          ),
                          child: const Text(
                            'UYB',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Unleash Your Brave',
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _isRegister
                              ? 'Create an account to begin your journey.'
                              : 'Sign in to continue your journey.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: Colors.brown.shade400,
                              ),
                        ),
                        const SizedBox(height: 28),
                        if (_isRegister) ...[
                          TextFormField(
                            controller: _nameController,
                            decoration: const InputDecoration(labelText: 'Name'),
                            validator: (value) =>
                                (value == null || value.trim().length < 2)
                                    ? 'Enter your name'
                                    : null,
                          ),
                          const SizedBox(height: 12),
                        ],
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(labelText: 'Email'),
                          validator: (value) =>
                              (value == null || !value.contains('@'))
                                  ? 'Enter a valid email'
                                  : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: true,
                          decoration: const InputDecoration(labelText: 'Password'),
                          validator: (value) =>
                              (value == null || value.length < 8)
                                  ? 'Password must be at least 8 characters'
                                  : null,
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: loading ? null : _submit,
                          child: Text(loading ? 'Please wait…' : (_isRegister ? 'Create account' : 'Sign in')),
                        ),
                        TextButton(
                          onPressed: loading
                              ? null
                              : () => setState(() => _isRegister = !_isRegister),
                          child: Text(
                            _isRegister
                                ? 'Already have an account? Sign in'
                                : 'Need an account? Register',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
