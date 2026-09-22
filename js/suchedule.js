// The terms on offer come from js/terms.js, which the scraper workflow regenerates
// whenever bannerweb adds a term or the courses of one change.
const terms = (() => {
    const seasons = {'01': 'Fall', '02': 'Spring', '03': 'Summer'};
    const selectionKey = 'selected-term';

    // Oldest first, as listed in js/terms.js.
    const codes = termConfig.map(entry => entry.term);

    let current = null;

    const all = () => codes.slice(0);

    const latest = () => codes[codes.length - 1];

    const includes = term => codes.indexOf(term) > -1;

    const dataVersion = term => termConfig.find(entry => entry.term === term).dataVersion;

    const dataFile = term => `data-${term}-v${dataVersion(term)}.min.json`;

    const infoLink = term => `https://suis.sabanciuniv.edu/prod/bwckschd.p_disp_detail_sched?term_in=${term}&crn_in=`;

    // Term codes are {first year of the academic year}{01 Fall, 02 Spring, 03 Summer},
    // so '202601' is the Fall term of the 2026-27 academic year.
    const getSeason = term => seasons[term.slice(4)];

    const getName = term => {
        const year = Number(term.slice(0, 4));

        return `${year}-${String(year + 1).slice(2)} ${getSeason(term)}`;
    };

    const getCurrent = () => current;

    const select = term => {
        current = term;

        localStorage.setItem(selectionKey, term);
    };

    // The term picked last time, or null when there is none or it is no longer offered.
    const getSavedSelection = () => {
        const saved = localStorage.getItem(selectionKey);

        return includes(saved) ? saved : null;
    };

    return {all, latest, includes, dataVersion, dataFile, infoLink, getSeason, getName, getCurrent, select, getSavedSelection};
})();

const templateGenerator = (() => {
    const getDayFromCode = (() => {
        // const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'TBA'];
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'TBA'];

        return dayCode => {
            return days[dayCode];
        };
    })();

    const getScheduleHours = (start, duration) => {
        if (start === -1) return 'TBA';

        start += 8;

        const end = start + duration;

        return `${start < 10 ? '0' : ''}${start}:40-${end < 10 ? '0' : ''}${end}:30`;
    };

    const makeCourseEntry = (course, instructors, places, term) => `
        <div class="course-entry hide-info" data-code="${course.code}">
            <div class="course-header">
                <div class="course-name">${course.code} - ${course.name}</div>
                <div class="course-expand icon-right-open-big"></div>
            </div>
            <div class="course-info">
            ${course.classes.map(_class => `
                <div class="course-sections">
                    <div class="section-type">Sections${_class.type ? ` (${_class.type})` : ``}</div>
                ${_class.sections.map(section => `
                    <div class="course-section" 
                        data-section-name="${course.code.replace(' ', '')}${_class.type} - ${section.group}"
                        data-crn="${section.crn}">
                    <div class="section-info">
                        <div class="section-header">
                            <div class="section-group" data-group="${section.group}">${section.group}</div>
                            <a href="${terms.infoLink(term)}${section.crn}" class="section-link" target="_blank">info</a>
                        </div>
                        <div class="instructor">${instructors[section.instructors]}</div>
                        <div class="section-days">
                        ${section.schedule.map(schedule => `
                            <div class="section-day" 
                                data-day="${schedule.day}"
                                data-start="${schedule.start}" 
                                data-duration="${schedule.duration}"
                                data-place="${places[schedule.place]}">
                                ${getDayFromCode(schedule.day)} ${getScheduleHours(schedule.start, schedule.duration)} ${places[schedule.place]}
                            </div>
                        `).join('')}
                        </div>
                    </div>
                    <div class="section-button"></div>
                    </div>
                `).join('')}
                </div>
            `).join('')}
            </div>
        </div>
    `;

    const makeCellCourse = (sectionName, crn, bgColor = 'azure') => `
        <div class="cell-course" data-crn="${crn}" data-section-name="${sectionName}"
            style="background-color: ${bgColor};">
            <div>${sectionName}</div>
            <div class="remove-course"></div>
        </div>
    `;

    return {
        makeCourseEntry,
        makeCellCourse
    };
})();

const colorPalette = (() => {
    let colors = [
        '#2096BA',
        '#C5919D',
        '#DF6E21',
        '#874E4C',
        '#32485C',
        '#765285',
        '#351C4D',
        '#FF7E5F',
        '#726A95',
        '#849974',
        '#36384C',
        '#F26968',
        '#F2AD9F',
        '#6CBF84',
        '#323339',
        '#AB3E16',
        '#EFAA52',
        '#48120E',
        '#B37C57',
        '#9AACB8'
    ];
    const initial = colors.slice(0);

    return {
        getColor: () => colors.splice(Math.floor(Math.random() * colors.length), 1).shift() || 'azure',
        putColor: color => color === 'azure' ? null : colors.push(color),
        reset: () => colors = initial.slice(0)
    };
})();

const storageKeys = () => {
    const keys = [];

    for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
    }

    return keys;
};

const saveSchedule = () => scheduleStorage.save();

// Every term has its own schedule, saved as the list of its CRNs.
const scheduleStorage = (() => {
    const keyOf = term => `saved-schedule-${term}`;

    const getCrns = (term = terms.getCurrent()) =>
        (localStorage.getItem(keyOf(term)) || '').split(',').filter(crn => crn !== '');

    const save = () => {
        localStorage.setItem(keyOf(terms.getCurrent()), cellCourses.getAllCrnDataToSave().join(','));
    };

    const set = (term, crns) => localStorage.setItem(keyOf(term), crns.join(','));

    const restore = () => {
        // The course entries are rendered from an async request when the data is not
        // cached, so there is nothing to restore onto until #course-list is populated.
        if ($('#course-list').hasClass('loading')) {
            return;
        }

        getCrns().forEach(crn => {
            $(`.course-section[data-crn="${crn}"]`).click();
        });

        // Sections that no longer exist were silently skipped above. Persisting the
        // pruned set keeps them from being reported again on the next data update.
        save();
    };

    // Drops the schedules of terms that are no longer offered.
    const dropStale = () => {
        storageKeys().forEach(key => {
            const keyParts = /^saved-schedule-(\d+)$/.exec(key);

            if (keyParts !== null && !terms.includes(keyParts[1])) {
                localStorage.removeItem(key);
            }
        });
    };

    return {getCrns, save, set, restore, dropStale};
})();

const courseDataDiff = (() => {
    const indexSections = ({courses, instructors, places}) => {
        const sections = {};

        courses.forEach(course => course.classes.forEach(_class => _class.sections.forEach(section => {
            sections[section.crn] = {
                name: `${course.code}${_class.type} - ${section.group}`,
                // Instructors and places are indices into arrays that are rebuilt by
                // every scrape, so they are resolved to text before being compared.
                instructor: instructors[section.instructors],
                hours: section.schedule
                    .map(({day, start, duration}) => `${day}|${start}|${duration}`).sort().join(),
                places: section.schedule.map(({place}) => places[place]).sort().join()
            };
        })));

        return sections;
    };

    const describeChanges = (before, after) => {
        const changes = [];

        if (before.hours !== after.hours) {
            changes.push('is rescheduled');
        }

        if (before.places !== after.places) {
            changes.push('is moved to another classroom');
        }

        if (before.instructor !== after.instructor) {
            changes.push('has a new instructor');
        }

        return changes;
    };

    // Compares the sections of the saved schedule between two versions of the course
    // data and returns one sentence per affected section.
    const forSavedSchedule = (crns, oldData, newData) => {
        const before = oldData === null ? null : indexSections(oldData);
        const after = indexSections(newData);

        return crns.map(crn => {
            if (!after.hasOwnProperty(crn)) {
                const name = before !== null && before.hasOwnProperty(crn) ? before[crn].name : `CRN ${crn}`;

                return `${name} is deleted`;
            }

            if (before === null || !before.hasOwnProperty(crn)) {
                return null;
            }

            const changes = describeChanges(before[crn], after[crn]);

            return changes.length === 0 ? null : `${after[crn].name} ${changes.join(' and ')}`;
        }).filter(change => change !== null);
    };

    return {forSavedSchedule};
})();

const showCourseDataUpdatedNotification = changes => {
    const message = changes.length === 0
        ? `Courses have been updated. This did not affect your existing schedule. `
          + `However, you might want to check what is new.`
        : `Courses have been updated. The following changes are made in your schedule:\n\n`
          + `${changes.map(change => `- ${change}`).join('\n')}\n\n`
          + `You may adjust your plans accordingly.`;

    const notification = $('#notify-courses-updated');

    notification.find('.notification-content p').text(message);

    notification.fadeIn(500);
};

const courseEntry = (() => {
    const courseEntry = function (codeOr$element) {
        if (!(codeOr$element instanceof $)) {
            return courseEntry.findByCode(codeOr$element);
        }

        return new courseEntry.prototype.Init(codeOr$element);
    };

    courseEntry.prototype.Init = function ($element) {
        this.getElement = function () {
            return $element.first();
        };

        return this;
    };

    courseEntry.prototype.Init.prototype = courseEntry.prototype;

    courseEntry.prototype.isOpen = function () {
        return !this.getElement().hasClass('hide-info');
    };

    courseEntry.prototype.open = function () {
        this.getElement().removeClass('hide-info');

        this.getElement().siblings(':not(hide-info)').addClass('hide-info');

        this.updateSelectionsOnSchedule();

        return this;
    };

    courseEntry.prototype.close = function () {
        this.getElement().addClass('hide-info');

        this.hideSelectionsOnSchedule();

        return this;
    };

    courseEntry.prototype.toggleOpen = function () {
        this.isOpen() ? this.close() : this.open();

        return this;
    };

    courseEntry.prototype.getCodeWithSpace = function () {
        return this.getElement().data('code');
    };

    courseEntry.prototype.getCodeWithoutSpace = function () {
        return this.getElement().data('code').replace(/ /g, '');
    };

    courseEntry.prototype.getName = function () {
        return this.getElement().find('.course-name').text();
    };

    courseEntry.prototype.showSelectionsOnSchedule = function () {
        this.getSections('.course-section.selected').forEach(section => {
            section.getClassCells().getElements().addClass('selection');
        });

        return this;
    };

    courseEntry.prototype.hideSelectionsOnSchedule = function () {
        $('.class-cell').removeClass('selection');

        return this;
    };

    courseEntry.prototype.updateSelectionsOnSchedule = function () {
        this.hideSelectionsOnSchedule();

        if (this.isOpen() && !this.isSelectionComplete()) {
            this.showSelectionsOnSchedule();
        }

        return this;
    };

    courseEntry.prototype.addFilter = function (filterName) {
        this.getElement().addClass(`filter-hide-${filterName}`);

        return this;
    };

    courseEntry.prototype.removeFilter = function (filterName) {
        this.getElement().removeClass(`filter-hide-${filterName}`);

        return this;
    };

    courseEntry.prototype.nameContains = function (query) {
        return this.getName().toUpperCase().indexOf(query) > -1;
    };

    courseEntry.prototype.isSelectionComplete = function () {
        return this.getElement().find('.selected').length === this.getElement().find('.course-sections').length;
    };

    courseEntry.prototype.isMainCourseSelected = function () {
        return this.getElement().find('.course-sections:first .selected').length > 0;
    };

    courseEntry.prototype.getSections = function (selector = '.course-section') {
        return $.map(this.getElement().find(selector), section => sectionEntry($(section)));
    };

    courseEntry.prototype.getCellCourseColor = function () {
        return cellCourses.findByCourseCode(this.getCodeWithoutSpace()).getColor();
    };

    courseEntry.prototype.isOnSchedule = function () {
        return cellCourses.findByCourseCode(this.getCodeWithoutSpace()).getElements().length > 0;
    };

    courseEntry.prototype.addToSchedule = function () {
        this.hideSelectionsOnSchedule();

        const color = colorPalette.getColor();

        this.getSections('.course-section.selected').forEach(section => {
            section.getClassCells().addCellCourse(cellCourses.make(section.getName(), section.getCrn(), color));
        });

        saveSchedule();

        return this;
    };

    courseEntry.prototype.removeFromSchedule = function () {
        if (this.isOnSchedule()) {
            colorPalette.putColor(this.getCellCourseColor());

            this.getSections().forEach(section => {
                classCells.findContainsCrn(section.getCrn()).removeCellCourse(section.getCrn());
            });
        }

        this.updateSelectionsOnSchedule();

        saveSchedule();

        return this;
    };

    courseEntry.prototype.actOnSectionSelected = function () {
        this.updateSelectionsOnSchedule();

        if (this.isSelectionComplete()) {
            this.addToSchedule();
        }

        return this;
    };

    courseEntry.prototype.actOnSectionDeselected = function () {
        this.removeFromSchedule();

        if (this.isMainCourseSelected() && !this.isOpen()) {
            courseEntry.endDisplayMode();
            courseEntry.startDisplayMode(this.getCodeWithSpace());
        }

        return this;
    };

    courseEntry.prototype.hasEmptySection = function () {
        for (const courseSections of this.getElement().find('.course-sections')) {
            if ($(courseSections).find('.course-section:not([class*=filter-hide-])').length === 0) {
                return true;
            }
        }

        return false;
    };

    courseEntry.closeAll = () => {
        $('.course-entry').addClass('hide-info');
    };

    courseEntry.findByCode = code => courseEntry($(`.course-entry[data-code="${code}"]`));

    courseEntry.clearFilter = filterName => {
        $('.course-entry').removeClass(`filter-hide-${filterName}`);
    };

    courseEntry.filter = (filter, filterName) => {
        $('.course-entry').each((i, course) => {
            course = courseEntry($(course));

            filter(course) ? course.removeFilter(filterName) : course.addFilter(filterName);
        });
    };

    courseEntry.filterIfAnyEmptySection = () => {
        courseEntry.filter(
            course => !course.hasEmptySection(),
            'empty-section'
        );
    };

    courseEntry.startDisplayMode = code => {
        courseEntry(code).open().getElement().addClass('display-alone');

        $('#menu').addClass('display-mode');

        $('body').removeClass('hide-menu');
    };

    courseEntry.endDisplayMode = () => {
        courseEntry($('.display-alone')).close().getElement().removeClass('display-alone');

        $('#menu').removeClass('display-mode');
    };

    courseEntry.isOnDisplayMode = () => $('#menu').hasClass('display-mode');

    courseEntry.make = (course, instructors) => courseEntry(templateGenerator.makeCourseEntry(course, instructors));

    courseEntry.populate = (courses, instructors, places, term) => {
        const $list = $('#course-list').removeClass('loading');

        courses.forEach(course => {
            $list.append(templateGenerator.makeCourseEntry(course, instructors, places, term));
        });
    };

    return courseEntry;
})();

const sectionEntry = (() => {
    const sectionEntry = function (crnOr$element) {
        if (!(crnOr$element instanceof $)) {
            return sectionEntry.findByCrn(crnOr$element);
        }

        return new sectionEntry.prototype.Init(crnOr$element);
    };

    sectionEntry.prototype.Init = function ($element) {
        this.getElement = function () {
            return $element;
        };

        return this;
    };

    sectionEntry.prototype.Init.prototype = sectionEntry.prototype;

    sectionEntry.prototype.getCrn = function () {
        return this.getElement().data('crn');
    };

    sectionEntry.prototype.getName = function () {
        return this.getElement().data('section-name');
    };

    sectionEntry.prototype.getInstructorName = function () {
        return this.getElement().find('.instructor').text();
    };

    sectionEntry.prototype.instructorNameContains = function (query) {
        return this.getInstructorName().toUpperCase().indexOf(query) > -1;
    };

    sectionEntry.prototype.getGeneralName = function () {
        return this.getName().split(' ', 2).shift();
    };

    sectionEntry.prototype.isSelected = function () {
        return this.getElement().hasClass('selected');
    };

    sectionEntry.prototype.deselectAlternatives = function () {
        this.getElement().siblings('.selected').each((i, section) => sectionEntry($(section)).deselect());

        return this;
    };

    sectionEntry.prototype.addFilter = function (filterName) {
        this.getElement().addClass(`filter-hide-${filterName}`);

        return this;
    };

    sectionEntry.prototype.removeFilter = function (filterName) {
        this.getElement().removeClass(`filter-hide-${filterName}`);

        return this;
    };

    sectionEntry.prototype.getCourseEntry = function () {
        return courseEntry(this.getElement().parents('.course-entry'));
    };

    sectionEntry.prototype.getScheduleData = function () {
        return this.getElement().find('.section-day').map((i, el) => ({
            day: $(el).data('day'),
            start: $(el).data('start'),
            duration: $(el).data('duration')
        })).toArray();
    };

    sectionEntry.prototype.getClassCells = function () {
        return classCells($(
            $.map(this.getScheduleData(), schedule =>
                $('#schedule tr').slice(schedule.start + 1, schedule.start + schedule.duration + 1)
                    .find(`td:eq(${schedule.day + 1})`).toArray()
            )
        ));
    };

    sectionEntry.prototype.select = function () {
        this.getElement().addClass('selected');

        this.deselectAlternatives();

        this.getCourseEntry().actOnSectionSelected();

        return this;
    };

    sectionEntry.prototype.deselect = function (shouldNotifyCourseEntry = true) {
        this.getElement().removeClass('selected');

        if (shouldNotifyCourseEntry) {
            this.getCourseEntry().actOnSectionDeselected();
        }

        return this;
    };

    sectionEntry.prototype.toggleSelect = function () {
        this.isSelected() ? this.deselect() : this.select();

        return this;
    };

    sectionEntry.findByCrn = crn => sectionEntry($(`.course-section[data-crn="${crn}"]:first`));

    sectionEntry.clearFilter = (filterName, checkForEmptySections = true) => {
        $('.course-section').removeClass(`filter-hide-${filterName}`);

        if (checkForEmptySections) courseEntry.filterIfAnyEmptySection();
    };

    sectionEntry.filter = (filter, filterName, checkForEmptySections = true) => {
        $('.course-section').each((i, section) => {
            section = sectionEntry($(section));

            filter(section) ? section.removeFilter(filterName) : section.addFilter(filterName);
        });

        if (checkForEmptySections) courseEntry.filterIfAnyEmptySection();
    };

    sectionEntry.filterByDays = () => {
        let allowedDays = [];

        $('#day-filter-selections input').each((i, checkbox) => {
            if ($(checkbox).is(':checked')) {
                allowedDays.push(i);
            }
        });

        //  TODO: Fix. This is a hack to always include courses with TBA days
        allowedDays.push(5);

        sectionEntry.filter(
            section => {
                for (const sectionDay of section.getElement().find('.section-day')) {
                    if (allowedDays.indexOf(Number($(sectionDay).data('day'))) === -1) {
                        return false;
                    }
                }

                return true;
            },
            'day'
        );
    };

    return sectionEntry;
})();

const cellCourses = (() => {
    const cellCourses = function (crnOr$element) {
        if (!(crnOr$element instanceof $)) {
            return cellCourses.findByCrn(crnOr$element);
        }

        return new cellCourses.prototype.Init(crnOr$element);
    };

    cellCourses.prototype.Init = function ($elements) {
        this.getElements = function () {
            return $elements;
        };

        return this;
    };

    cellCourses.prototype.Init.prototype = cellCourses.prototype;

    cellCourses.prototype.getSectionName = function () {
        return this.getElements().first().data('section-name');
    };

    cellCourses.prototype.getCourseCodeWithSpace = function () {
        return this.getSectionName().replace(/([A-Z]+)(\d+).*/, '$1 $2');
    };

    cellCourses.prototype.getCourseCodeWithoutSpace = function () {
        return this.getSectionName().replace(/([A-Z]+)(\d+).*/, '$1$2');
    };

    cellCourses.prototype.getParentClassCells = function () {
        return classCells(this.getElements().parent());
    };

    cellCourses.prototype.isOfMainCourse = function () {
        return /^[A-Z]+\d+ .*$/.test(this.getSectionName());
    };

    cellCourses.prototype.animateCloseButtons = function (propagate = true) {
        if (propagate && this.isOfMainCourse()) {
            cellCourses.findByCourseCode(this.getCourseCodeWithoutSpace()).animateCloseButtons(false);
        }

        this.getElements().addClass('animate');

        return this;
    };

    cellCourses.prototype.getColor = function () {
        return this.getElements().first().css('background-color');
    };

    cellCourses.getAllCrnDataToCopy = () => {
        const crnObj = {};
        let results = [];

        $('.cell-course').each((i, element) => {
            const crn = $(element).data('crn');

            if (!crnObj.hasOwnProperty(crn)) {
                results.push(`${$(element).data('section-name')}: ${crn}`);
            }

            crnObj[$(element).data('crn')] = 1;
        });

        return results.sort().join('\n');
    };

    cellCourses.getAllCrnDataToSave = () => {
        const crnObj = {};

        $('.cell-course').each((i, element) => {
            crnObj[$(element).data('crn')] = 1;
        });

        return Object.keys(crnObj);
    };

    cellCourses.findByCrn = crn => cellCourses($(`.cell-course[data-crn="${crn}"]`));

    cellCourses.findByGeneralSectionName = name => cellCourses($(`.cell-course[data-section-name^="${name}"]`));

    cellCourses.findByCourseCode = code => cellCourses($(`.cell-course[data-section-name^="${code}"]`));

    cellCourses.make = (sectionName, crn, bgColor) => {
        return cellCourses($(templateGenerator.makeCellCourse(sectionName, crn, bgColor)));
    };

    return cellCourses;
})();

const classCells = (() => {
    const classCells = function (crnOr$elements) {
        if (!(crnOr$elements instanceof $)) {
            return classCells.findContainsCrn(crnOr$elements)
        }

        return new classCells.prototype.Init(crnOr$elements);
    };

    classCells.prototype.Init = function ($elements) {
        this.getElements = function () {
            return $elements;
        };

        return this;
    };

    classCells.prototype.Init.prototype = classCells.prototype;

    classCells.prototype.getElementsByChildrenCount = function (count) {
        return $(
            $.map(this.getElements(), element => {
                if ($(element).children().length === count) {
                    return element;
                }
            })
        );
    };

    classCells.prototype.addCellCourse = function (cellCourse) {
        this.getElements().addClass('filled').append(cellCourse.getElements().first().clone());

        this.getElementsByChildrenCount(1).addClass('make-available');

        return this;
    };

    classCells.prototype.removeCellCourse = function (crn) {
        cellCourses.findByCrn(crn).getElements().remove();

        this.getElementsByChildrenCount(0).removeClass('filled');

        return this;
    };

    classCells.clearInterests = () => {
        $('.interested').removeClass('interested').removeClass('make-available');
    };

    classCells.findContainsCrn = crn => classCells($('.class-cell').has(`[data-crn="${crn}"]`));

    return classCells;
})();

(showFirstVisitNotifications = () => {
    if (localStorage.getItem('visited-before') === null) {
        localStorage.setItem('visited-before', 'yes');

        $('#notify-about').show();
        $('#notify-cookies').show();
    }
})();

// The course data of every term is cached under course-data-{term}-{version}. The
// key of an older version is the only record of what the user saw last time.
const courseData = (() => {
    const keyOf = term => `course-data-${term}-${terms.dataVersion(term)}`;

    const findCached = () => storageKeys().filter(key => key.indexOf('course-data') === 0).map(key => {
        const keyParts = /^course-data-(\d+)-(\d+)$/.exec(key);

        return {
            key: key,
            term: keyParts === null ? null : keyParts[1],
            version: keyParts === null ? -1 : Number(keyParts[2])
        };
    });

    const read = key => {
        try {
            const cached = JSON.parse(localStorage.getItem(key));

            // Releases before the data version scheme cached no places, which makes
            // their data impossible to compare against.
            return cached !== null && Array.isArray(cached.places) ? cached : null;
        } catch (error) {
            return null;
        }
    };

    // The terms that earlier visits cached data for, whether still offered or not.
    const getCachedTerms = () => findCached().map(entry => entry.term).filter(term => term !== null);

    // Drops the data of terms that are no longer offered.
    const dropStale = () => {
        findCached().filter(entry => !terms.includes(entry.term)).forEach(entry => localStorage.removeItem(entry.key));
    };

    // Hands the data of the term to onLoaded straight from the cache when the current
    // version is there. Otherwise it is fetched and cached first, and onLoaded also
    // receives whether an older version was cached, along with that version's data.
    const load = (term, onLoaded, onFailed) => {
        const key = keyOf(term);
        const cached = read(key);

        if (cached !== null) {
            onLoaded(cached, null);

            return;
        }

        $.getJSON(terms.dataFile(term)).done(data => {
            const previous = findCached().filter(entry => entry.term === term && entry.key !== key)
                .sort((a, b) => b.version - a.version);
            const previousData = previous.length === 0 ? null : read(previous[0].key);

            previous.forEach(entry => localStorage.removeItem(entry.key));

            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (error) {
                // No room left to cache it; the data is simply fetched again next time.
            }

            onLoaded(data, {hadPrevious: previous.length > 0, previousData: previousData});
        }).fail(onFailed);
    };

    return {getCachedTerms, dropStale, load};
})();

const legacyStorage = (() => {
    // Until September 2026 the site showed a single term: its schedule was saved under
    // 'saved-schedule' and its course data cached under course-data-{term}-{version}.
    // Moves that schedule under its term and returns the term the user was on, or null
    // when it is no longer offered.
    const migrate = () => {
        const cachedTerms = courseData.getCachedTerms();
        const crns = localStorage.getItem('saved-schedule');

        // Without any cached data there is no record of the term, but it can only have
        // been the newest one.
        const lastTerm = cachedTerms.length === 0
            ? terms.latest()
            : cachedTerms.find(term => terms.includes(term)) || null;

        if (crns === null) {
            return lastTerm;
        }

        localStorage.removeItem('saved-schedule');

        const savedCrns = crns.split(',').filter(crn => crn !== '');

        if (lastTerm !== null) {
            scheduleStorage.set(lastTerm, savedCrns);
        } else if (savedCrns.length > 0) {
            // A schedule of a term that is no longer offered is of no use.
            $('#notify-data-updated').fadeIn(500);
        }

        return lastTerm;
    };

    return {migrate};
})();

const showLoadFailedNotification = term => {
    const notification = $('#notify-load-failed');

    notification.find('.notification-content p').text(
        `The courses of ${terms.getName(term)} could not be loaded. `
        + `Please check your connection and refresh the page.`
    );

    notification.fadeIn(500);
};

// The Select Term button in the header and its dropdown.
const termSelector = (() => {
    const introKey = 'term-select-intro-dismissed';

    const isOpen = () => $('#term-select').hasClass('open');

    const close = () => $('#term-select').removeClass('open');

    const open = () => {
        $('#term-select').addClass('open');

        dismissIntro();
    };

    const toggle = () => isOpen() ? close() : open();

    const build = () => {
        const $menu = $('#term-menu');

        terms.all().forEach(term => {
            $menu.append(`<div class="term-option" data-term="${term}">${terms.getName(term)}</div>`);
        });
    };

    // Reflects the current term on the button and in the dropdown.
    const render = () => {
        const current = terms.getCurrent();

        $('#term-label').attr('data-full', terms.getName(current)).attr('data-short', terms.getSeason(current));
        $('#term-button').attr('title', `Select Term (${terms.getName(current)})`);
        $('.term-option').removeClass('selected').filter(`[data-term="${current}"]`).addClass('selected');
    };

    // A one-time notice pointing at the button. It stays until the user either
    // dismisses it or opens the dropdown, and is not shown again after that.
    const showIntro = () => {
        if (localStorage.getItem(introKey) !== null) {
            return;
        }

        $('#notify-term-select').show();
        $('#term-button').addClass('attention');
    };

    const dismissIntro = () => {
        if (!$('#term-button').hasClass('attention')) {
            return;
        }

        localStorage.setItem(introKey, 'yes');

        $('#term-button').removeClass('attention');
        $('#notify-term-select').fadeOut(500);
    };

    return {isOpen, open, close, toggle, build, render, showIntro, dismissIntro};
})();

// Puts a term on the screen: its course list in the menu and its saved schedule on
// the table.
const termView = (() => {
    let loadCount = 0;

    // Empties the schedule table, leaving the storage as it is.
    const clearSchedule = () => {
        $('.course-section.selected').removeClass('selected');
        $('.class-cell').attr('class', 'class-cell').children().remove();

        colorPalette.reset();
    };

    // The filters are kept in the inputs, so a freshly built list has to be run
    // through them again.
    const applyFilters = () => {
        if (($('#search-box').val() || '') !== '') {
            $('#search-box').trigger('input');
        }

        if ($('#day-filter-selections input:not(:checked)').length > 0) {
            sectionEntry.filterByDays();
        }
    };

    const show = term => {
        const loadId = ++loadCount;

        terms.select(term);
        termSelector.render();

        courseEntry.endDisplayMode();
        clearSchedule();

        $('#course-list').empty().addClass('loading');

        courseData.load(term, (data, update) => {
            // The user has moved on to another term while this one was being fetched.
            if (loadId !== loadCount) {
                return;
            }

            const {courses, instructors, places} = data;
            const crns = scheduleStorage.getCrns(term);

            courseEntry.populate(courses, instructors, places, term);
            applyFilters();

            // Everything the saved schedule still points at is kept as it is; sections
            // that moved follow the new data, and deleted ones simply drop out.
            scheduleStorage.restore();

            if (update === null) {
                return;
            }

            const changes = courseDataDiff.forSavedSchedule(crns, update.previousData, data);

            if (update.hadPrevious || changes.length > 0) {
                showCourseDataUpdatedNotification(changes);
            }
        }, () => {
            if (loadId === loadCount) {
                $('#course-list').removeClass('loading');

                showLoadFailedNotification(term);
            }
        });
    };

    return {show, clearSchedule};
})();

(setEvents = () => {
    $(document).on('click', '.course-header', event => {
        courseEntry($(event.currentTarget).parent()).toggleOpen();

        if (courseEntry.isOnDisplayMode()) {
            courseEntry.endDisplayMode();
        }
    });

    $(document).on('click', '.section-link', event => {
        event.stopPropagation();
    });

    $(document).on('click', '.course-section', event => {
        sectionEntry($(event.currentTarget)).toggleSelect();
    });

    $(document).on('click', '.remove-course', event => {
        sectionEntry($(event.currentTarget).parent().data('crn')).toggleSelect();

        event.stopPropagation();
    });

    $(document).on('mouseenter', '.remove-course,.course-section.selected', event => {
        cellCourses($(event.currentTarget).closest('[data-crn]').data('crn')).animateCloseButtons();
    });

    $(document).on('mouseleave', '.remove-course,.course-section.selected', event => {
        $('.cell-course.animate').removeClass('animate');

        event.stopPropagation();
    });

    $(document).on('click', '.cell-course', event => {
        courseEntry.startDisplayMode(cellCourses($(event.currentTarget)).getCourseCodeWithSpace());
    });

    $(document).on('mouseenter', '.course-section', event => {
        const section = sectionEntry($(event.currentTarget));

        section.getClassCells().getElements().addClass('interested');

        cellCourses.findByGeneralSectionName(section.getGeneralName()).getParentClassCells().getElements()
            .filter('.interested').addClass('make-available');
    });

    $(document).on('mouseleave', '.course-section', () => {
        classCells.clearInterests();
    });

    const searchParameterChange = event => {
        courseEntry.closeAll();

        const filterName = 'search';

        const searchQuery = ($('#search-box').val() || '').toUpperCase();

        switch ($('#search-category').val()) {
            case 'name':
                courseEntry.filter(
                    course => course.nameContains(searchQuery),
                    filterName
                );
                sectionEntry.clearFilter(filterName);
                break;
            case 'instructor':
                courseEntry.clearFilter(filterName);
                sectionEntry.filter(
                    section => section.instructorNameContains(searchQuery),
                    filterName
                );
                break;
        }
    };

    $('#search-category').on('change', searchParameterChange);

    $('#search-box').on('input', searchParameterChange);

    $('#menu-toggle').on('click', () => $('body').toggleClass('hide-menu'));

    $(document).on('keyup', (() => {
        const ESC_KEY = 27;

        return event => {
            if (event.keyCode === ESC_KEY) {
                if (termSelector.isOpen()) {
                    termSelector.close();
                } else if (courseEntry.isOnDisplayMode()) {
                    courseEntry.endDisplayMode();
                } else {
                    $('#search-box').val('').trigger('input');
                }
            }
        };
    })());

    $(document).on('click', '#clear-button', () => {
        $('#notify-clear .notification-content p')
            .text(`Are you sure you want to clear your ${terms.getName(terms.getCurrent())} schedule?`);

        $('#notify-clear').fadeIn(500);
    });

    $(document).on('click', '#about-button', () => $('#notify-about').fadeIn(500));
    $(document).on('click', '#about-button', () => $('#notify-cookies').fadeIn(500));
})();

(setWeekdayFilterEvents = () => {
    $(document).on('input', '#day-filter-selections input', event => {
        sectionEntry.filterByDays();
    });

    if ($('#day-filter-selections input:not(:checked)').length > 0) {
        sectionEntry.filterByDays();

        $('#day-filter-selections').show();
    }
})();

(setTermSelectorEvents = () => {
    $(document).on('click', '#term-button', () => termSelector.toggle());

    $(document).on('click', '.term-option', event => {
        const term = $(event.currentTarget).attr('data-term');

        termSelector.close();

        if (term !== terms.getCurrent()) {
            termView.show(term);
        }
    });

    $(document).on('click', event => {
        if (termSelector.isOpen() && $(event.target).closest('#term-select').length === 0) {
            termSelector.close();
        }
    });

    $(document).on('click', '#notify-term-select .button', () => termSelector.dismissIntro());
})();

(initializeTerms = () => {
    const lastTerm = legacyStorage.migrate();

    courseData.dropStale();
    scheduleStorage.dropStale();

    termSelector.build();
    termSelector.showIntro();

    // The events above must be in place before the first term is shown: restoring a
    // schedule from a cached term happens synchronously and goes through them.
    termView.show(terms.getSavedSelection() || lastTerm || terms.latest());
})();

(setNotificationEvents = () => {
    $(document).on('click', '.notification .button', event => {
        $(event.target).closest('.notification').fadeOut(500);
    });

    $(document).on('click', '#notify-clear .notification-button', () => {
        termView.clearSchedule();

        saveSchedule();
    });
})();

(initializeClipboardJS = () => {
    const clipboard = new ClipboardJS('#copy-button', {
        text: () => cellCourses.getAllCrnDataToCopy()
    });

    clipboard.on('success', () => {
        const notification = $('#notify-copied');

        notification.fadeIn(500);

        setTimeout(() => {
            notification.fadeOut(500);
        }, 2000);
    });

    clipboard.on('error', event => {
        const notification = $('#notify-copy-fail');

        notification.find('.notification-content p').text(event.text);

        notification.fadeIn(500);
    });
})();
