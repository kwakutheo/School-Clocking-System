import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// An interactive, expandable bottom sheet displaying FAQs
/// loaded from [assets/FAQ/faq.json].
class FaqBottomSheet extends StatefulWidget {
  const FaqBottomSheet({super.key});

  /// Displays the FAQ bottom sheet modal.
  static void show(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const FaqBottomSheet(),
    );
  }

  @override
  State<FaqBottomSheet> createState() => _FaqBottomSheetState();
}

class _FaqBottomSheetState extends State<FaqBottomSheet> {
  bool _loading = true;
  String? _errorMessage;
  List<Map<String, dynamic>> _allFaqs = [];
  List<Map<String, dynamic>> _filteredFaqs = [];
  List<String> _categories = ['All'];
  String _selectedCategory = 'All';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadFaqs();
    _searchController.addListener(_filterFaqs);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadFaqs() async {
    try {
      final jsonString = await rootBundle.loadString('assets/FAQ/faq.json');
      final data = jsonDecode(jsonString) as Map<String, dynamic>;
      final rawList = data['faqs'] as List<dynamic>? ?? [];

      final faqs =
          rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();

      final categorySet = <String>{};
      for (final faq in faqs) {
        final cat = faq['category']?.toString();
        if (cat != null && cat.isNotEmpty) {
          categorySet.add(cat);
        }
      }

      if (mounted) {
        setState(() {
          _allFaqs = faqs;
          _filteredFaqs = faqs;
          _categories = ['All', ...categorySet];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load FAQs: $e';
          _loading = false;
        });
      }
    }
  }

  void _filterFaqs() {
    final query = _searchController.text.trim().toLowerCase();

    setState(() {
      _filteredFaqs = _allFaqs.where((faq) {
        final matchesCategory = _selectedCategory == 'All' ||
            (faq['category']?.toString().toLowerCase() ==
                _selectedCategory.toLowerCase());

        if (!matchesCategory) return false;

        if (query.isEmpty) return true;

        final question = faq['question']?.toString().toLowerCase() ?? '';
        final answer = faq['answer']?.toString().toLowerCase() ?? '';
        final tags = (faq['tags'] as List<dynamic>?)
                ?.map((t) => t.toString().toLowerCase())
                .toList() ??
            [];

        final matchesQuery = question.contains(query) ||
            answer.contains(query) ||
            tags.any((t) => t.contains(query));

        return matchesQuery;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final media = MediaQuery.of(context);

    return Container(
      height: media.size.height * 0.88,
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── Drag Handle ──────────────────────────────────────────────────
          const SizedBox(height: 12),
          Center(
            child: Container(
              width: 44,
              height: 4.5,
              decoration: BoxDecoration(
                color: cs.onSurfaceVariant.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),

          // ── Header ────────────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 12, 10),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: cs.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.quiz_rounded,
                    color: cs.onPrimaryContainer,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'FAQ & Guide',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        'Quick answers and troubleshooting',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                  tooltip: 'Close',
                ),
              ],
            ),
          ),

          // ── Search Field ──────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search questions, keywords (GPS, offline)...',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18),
                        onPressed: () {
                          _searchController.clear();
                        },
                      )
                    : null,
                filled: true,
                fillColor: cs.surfaceContainerHighest.withValues(alpha: 0.5),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // ── Categories Horizontal Bar ─────────────────────────────────────
          if (_categories.length > 1)
            SizedBox(
              height: 48,
              child: ListView.separated(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                scrollDirection: Axis.horizontal,
                itemCount: _categories.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final cat = _categories[index];
                  final isSelected = cat == _selectedCategory;
                  return ChoiceChip(
                    label: Text(cat),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        setState(() {
                          _selectedCategory = cat;
                        });
                        _filterFaqs();
                      }
                    },
                    selectedColor: cs.primaryContainer,
                    labelStyle: TextStyle(
                      color: isSelected
                          ? cs.onPrimaryContainer
                          : cs.onSurfaceVariant,
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.normal,
                      fontSize: 12,
                    ),
                    side: BorderSide(
                      color: isSelected
                          ? cs.primary
                          : cs.outlineVariant.withValues(alpha: 0.4),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  );
                },
              ),
            ),

          const Divider(height: 1),

          // ── Results List ──────────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.error_outline_rounded,
                                  color: cs.error, size: 40),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: TextStyle(color: cs.error),
                              ),
                              const SizedBox(height: 16),
                              FilledButton.tonal(
                                onPressed: _loadFaqs,
                                child: const Text('Try Again'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _filteredFaqs.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.search_off_rounded,
                                    size: 54,
                                    color: cs.onSurfaceVariant
                                        .withValues(alpha: 0.4),
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    'No matching questions found',
                                    style: theme.textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Try adjusting your search terms or choosing another category.',
                                    textAlign: TextAlign.center,
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: cs.onSurfaceVariant,
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  TextButton.icon(
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() {
                                        _selectedCategory = 'All';
                                      });
                                      _filterFaqs();
                                    },
                                    icon: const Icon(Icons.refresh_rounded),
                                    label: const Text('Reset Filters'),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                            itemCount: _filteredFaqs.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final faq = _filteredFaqs[index];
                              final category =
                                  faq['category']?.toString() ?? 'General';
                              final question =
                                  faq['question']?.toString() ?? '';
                              final answer = faq['answer']?.toString() ?? '';

                              return Card(
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  side: BorderSide(
                                    color: cs.outlineVariant
                                        .withValues(alpha: 0.5),
                                  ),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: Theme(
                                  data: theme.copyWith(
                                    dividerColor: Colors.transparent,
                                  ),
                                  child: ExpansionTile(
                                    tilePadding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 6,
                                    ),
                                    childrenPadding: const EdgeInsets.fromLTRB(
                                        16, 0, 16, 16),
                                    leading: Container(
                                      width: 28,
                                      height: 28,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color:
                                            cs.primary.withValues(alpha: 0.1),
                                        shape: BoxShape.circle,
                                      ),
                                      child: Text(
                                        '${index + 1}',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                          color: cs.primary,
                                        ),
                                      ),
                                    ),
                                    title: Text(
                                      question,
                                      style:
                                          theme.textTheme.bodyMedium?.copyWith(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    subtitle: Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Align(
                                        alignment: Alignment.centerLeft,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: cs.secondaryContainer
                                                .withValues(alpha: 0.6),
                                            borderRadius:
                                                BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            category,
                                            style: TextStyle(
                                              fontSize: 10.5,
                                              fontWeight: FontWeight.w500,
                                              color: cs.onSecondaryContainer,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    children: [
                                      Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: cs.surfaceContainerHighest
                                              .withValues(alpha: 0.35),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          answer,
                                          style: theme.textTheme.bodyMedium
                                              ?.copyWith(
                                            height: 1.5,
                                            color: cs.onSurface,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
