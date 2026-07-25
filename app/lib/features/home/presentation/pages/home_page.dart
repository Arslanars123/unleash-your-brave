import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:unleash_your_brave/features/auth/presentation/bloc/auth_bloc.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthBloc, AuthState>(
      builder: (context, state) {
        final user = state is AuthAuthenticated ? state.user : null;

        return Scaffold(
          appBar: AppBar(
            title: const Text('Unleash Your Brave'),
            actions: [
              IconButton(
                tooltip: 'Sign out',
                onPressed: () {
                  context.read<AuthBloc>().add(const AuthLogoutRequested());
                  context.go('/login');
                },
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          body: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Welcome${user == null ? '' : ', ${user.name}'}',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Your clean-architecture Flutter client is ready. '
                  'Add new features under lib/features/ as independent slices.',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: Colors.brown.shade500,
                      ),
                ),
                const SizedBox(height: 24),
                if (user != null)
                  Card(
                    elevation: 0,
                    color: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: const Color(0xFFC2410C),
                        child: Text(
                          user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
                          style: const TextStyle(color: Colors.white),
                        ),
                      ),
                      title: Text(user.name),
                      subtitle: Text('${user.email} · ${user.role}'),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}
